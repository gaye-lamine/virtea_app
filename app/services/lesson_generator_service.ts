import { AiService, type LessonPlan } from './ai_service.js'
import { WikipediaService } from './wikipedia_service.js'
import { TTSService } from './tts_service.js'
import { CloudinaryService } from './cloudinary_service.js'
import { WebSocketService } from './websocket_service.js'
import Lesson from '#models/lesson'

export interface GeneratedLesson extends LessonPlan {
  sections: {
    title: string
    subsections: {
      title: string
      content: string
      imageQuery: string
      image?: {
        url: string
        title: string
        description?: string
      }
    }[]
  }[]
}

export class LessonGeneratorService {
  private aiService: AiService
  private wikipediaService: WikipediaService
  private ttsService: TTSService
  private cloudinaryService: CloudinaryService

  constructor() {
    this.aiService = new AiService()
    this.wikipediaService = new WikipediaService()
    this.ttsService = new TTSService()
    this.cloudinaryService = new CloudinaryService()
  }

  async generateLesson(
    lessonId: number, 
    title: string, 
    userProfile?: {
      profileType: string
      educationLevel?: string
      specialty?: string
    }
  ): Promise<void> {
    try {
      console.log(`Génération progressive de la leçon ${lessonId}: ${title}`)
      if (userProfile) {
        console.log(`Profil utilisateur: ${userProfile.profileType} ${userProfile.educationLevel || ''} ${userProfile.specialty || ''}`)
      }
      
      // Notifier le début de génération
      await WebSocketService.sendProgress(lessonId, 10, 'Génération du plan de cours...')
      
      // 1. Générer le plan avec l'IA (adapté au profil)
      const lessonPlan = await this.aiService.generateLessonPlan(title, userProfile)
      
      // 2. Récupérer rapidement les images pour la première section
      console.log('Récupération des images pour la première section...')
      const firstSectionImages: string[] = []
      if (lessonPlan.sections.length > 0) {
        lessonPlan.sections[0].subsections.forEach(subsection => {
          firstSectionImages.push(subsection.imageQuery)
        })
      }
      
      const firstImages = await this.wikipediaService.getMultipleImages(firstSectionImages)
      console.log(`Images récupérées pour première section: ${firstImages.filter(img => img !== null).length}/${firstImages.length}`)
      
      // 3. Sauvegarder le plan avec les premières images
      const lesson = await Lesson.findOrFail(lessonId)
      lesson.description = lessonPlan.description
      lesson.plan = JSON.stringify({
        sections: lessonPlan.sections.map(s => ({ title: s.title }))
      })
      
      // Ajouter les images à la première section et initialiser les autres sections
      const contentWithFirstImages = {
        ...lessonPlan,
        sections: lessonPlan.sections.map((section, sectionIndex) => {
          if (sectionIndex === 0) {
            // Première section avec images
            return {
              ...section,
              subsections: section.subsections.map((subsection, subIndex) => ({
                ...subsection,
                image: firstImages[subIndex] || undefined
              }))
            }
          } else {
            // Autres sections sans images pour l'instant
            return {
              ...section,
              subsections: section.subsections.map(subsection => ({
                ...subsection,
                image: undefined
              }))
            }
          }
        }),
        audioFiles: {} // Initialiser les fichiers audio
      }
      
      lesson.content = JSON.stringify(contentWithFirstImages)
      lesson.status = 'plan_ready'
      await lesson.save()
      
      await WebSocketService.sendProgress(lessonId, 30, 'Plan prêt ! Génération de l\'introduction...')
      
      // 3. Générer l'audio d'introduction en priorité
      const introAudio = await this.ttsService.generateAudio({
        text: `Bienvenue dans cette leçon sur ${lessonPlan.title}. ${lessonPlan.description}`
      })
      const introUrl = await this.ttsService['saveAudioFile'](introAudio, 'intro')
      
      // 4. Sauvegarder avec l'intro prête (en préservant les images de la première section)
      const currentContent = typeof lesson.content === 'string' 
        ? JSON.parse(lesson.content || '{}')
        : lesson.content || {}
      const partialContent = {
        ...currentContent, // Préserver le contenu existant avec les images
        audioFiles: { intro: introUrl }
      }
      
      lesson.content = JSON.stringify(partialContent)
      lesson.status = 'intro_ready'
      await lesson.save()
      
      await WebSocketService.sendProgress(lessonId, 50, 'Introduction prête ! Vous pouvez commencer...')
      
      // 5. Générer le reste en arrière-plan
      this.generateRemainingContent(lessonId, lessonPlan).catch(error => {
        console.error('Erreur génération contenu restant:', error)
      })
      
    } catch (error) {
      console.error(`Erreur génération leçon ${lessonId}:`, error)
      
      // Marquer la leçon comme échouée
      const lesson = await Lesson.find(lessonId)
      if (lesson) {
        lesson.status = 'draft'
        await lesson.save()
      }
      
      // Notifier l'erreur
      await WebSocketService.sendLessonError(lessonId, error.message)
      
      throw error
    }
  }

  private async generateRemainingContent(lessonId: number, lessonPlan: LessonPlan): Promise<void> {
    try {
      console.log(`Génération du contenu restant pour la leçon ${lessonId}`)
      
      // 1. Récupérer le contenu actuel avec les images de la première section
      const currentLesson = await Lesson.findOrFail(lessonId)
      const currentContent = typeof currentLesson.content === 'string' 
        ? JSON.parse(currentLesson.content || '{}')
        : currentLesson.content || {}
      
      // 2. Collecter les requêtes d'images pour les sections restantes (à partir de la section 1)
      const remainingImageQueries: string[] = []
      const imageQueryMap: { [key: string]: { sectionIndex: number, subsectionIndex: number } } = {}
      
      lessonPlan.sections.forEach((section, sectionIndex) => {
        if (sectionIndex > 0) { // Ignorer la première section qui a déjà ses images
          section.subsections.forEach((subsection, subsectionIndex) => {
            remainingImageQueries.push(subsection.imageQuery)
            imageQueryMap[subsection.imageQuery] = { sectionIndex, subsectionIndex }
          })
        }
      })
      
      // 3. Récupérer et optimiser les images en parallèle
      console.log(`Récupération de ${remainingImageQueries.length} images restantes...`)
      const [remainingImages] = await Promise.all([
        this.wikipediaService.getMultipleImages(remainingImageQueries),
        WebSocketService.sendProgress(lessonId, 60, 'Images en cours...')
      ])
      
      // 4. Optimiser les images valides immédiatement
      const validImages = remainingImages.filter(img => img !== null)
      console.log(`Optimisation de ${validImages.length} images valides...`)
      const [optimizedImages] = await Promise.all([
        this.cloudinaryService.optimizeImages(validImages),
        WebSocketService.sendProgress(lessonId, 70, 'Optimisation...')
      ])
      
      // 5. Assembler le contenu final en préservant les images de la première section
      let optimizedIndex = 0
      const generatedLesson: GeneratedLesson = {
        ...lessonPlan,
        sections: lessonPlan.sections.map((section, sectionIndex) => ({
          ...section,
          subsections: section.subsections.map((subsection, subsectionIndex) => {
            // Préserver les images de la première section
            if (sectionIndex === 0 && currentContent.sections && currentContent.sections[0]) {
              const existingSubsection = currentContent.sections[0].subsections[subsectionIndex]
              return {
                ...subsection,
                image: existingSubsection?.image || undefined
              }
            }
            
            // Ajouter les nouvelles images pour les autres sections
            const imageIndex = remainingImageQueries.indexOf(subsection.imageQuery)
            if (imageIndex >= 0) {
              const originalImage = remainingImages[imageIndex]
              let finalImage = originalImage
              
              if (originalImage && optimizedImages[optimizedIndex]) {
                finalImage = {
                  ...originalImage,
                  url: optimizedImages[optimizedIndex]?.url || originalImage.url
                }
                optimizedIndex++
              }
              
              return {
                ...subsection,
                image: finalImage || undefined
              }
            }
            
            return {
              ...subsection,
              image: undefined
            }
          })
        }))
      }
      
      // 5. Générer les fichiers audio restants
      await WebSocketService.sendProgress(lessonId, 80, 'Génération audio des sections...')
      const audioFiles = await this.ttsService.generateLessonAudio(generatedLesson)
      
      // 6. Ajouter les URLs audio au contenu
      const finalLesson = {
        ...generatedLesson,
        audioFiles
      }
      
      // 7. Mettre à jour la leçon complète
      const lesson = await Lesson.findOrFail(lessonId)
      lesson.content = JSON.stringify(finalLesson)
      lesson.status = 'ready'
      await lesson.save()
      
      // Notifier que la leçon est complètement prête
      await WebSocketService.sendLessonReady(lessonId, finalLesson)
      
      console.log(`Leçon ${lessonId} complètement générée avec succès`)
      
    } catch (error) {
      console.error(`Erreur génération contenu restant ${lessonId}:`, error)
      await WebSocketService.sendLessonError(lessonId, error.message)
    }
  }
}