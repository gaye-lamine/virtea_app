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
      country?: string
      institutionName?: string
      series?: string
      studyYear?: string
    }
  ): Promise<void> {
    try {
      console.log(`Génération progressive de la leçon ${lessonId}: ${title}`)
      if (userProfile) {
        console.log(`Profil utilisateur: ${userProfile.profileType} ${userProfile.educationLevel || ''} ${userProfile.specialty || ''}`)
      }

      await WebSocketService.sendProgress(lessonId, 10, 'Génération du plan de cours...')

      const lessonPlan = await this.aiService.generateLessonPlan(title, userProfile)

      console.log('Récupération des images pour la première section...')
      const firstSectionImages: string[] = []
      if (lessonPlan.sections && lessonPlan.sections.length > 0) {
        lessonPlan.sections[0].subsections.forEach(subsection => {
          firstSectionImages.push(subsection.imageQuery)
        })
      } else {
        console.warn('⚠️ Attention: Aucune section trouvée dans le plan de leçon')
      }

      const firstImages = await this.wikipediaService.getMultipleImages(firstSectionImages)
      console.log(`Images récupérées pour première section: ${firstImages.filter(img => img !== null).length}/${firstImages.length}`)

      const lesson = await Lesson.findOrFail(lessonId)
      lesson.description = lessonPlan.description
      lesson.plan = JSON.stringify({
        sections: lessonPlan.sections.map(s => ({ title: s.title }))
      })

      const contentWithFirstImages = {
        ...lessonPlan,
        sections: lessonPlan.sections.map((section, sectionIndex) => {
          const sectionId = crypto.randomUUID()
          if (sectionIndex === 0) {
            return {
              ...section,
              id: section.id || sectionId,
              check_understanding: section.check_understanding || false,
              subsections: section.subsections.map((subsection, subIndex) => ({
                ...subsection,
                image: firstImages[subIndex] || undefined
              }))
            }
          } else {
            return {
              ...section,
              id: section.id || sectionId,
              check_understanding: section.check_understanding || false,
              subsections: section.subsections.map(subsection => ({
                ...subsection,
                image: undefined
              }))
            }
          }
        }),
        audioFiles: {}
      }

      lesson.content = JSON.stringify(contentWithFirstImages)
      lesson.status = 'plan_ready'
      await lesson.save()

      await WebSocketService.sendProgress(lessonId, 30, 'Plan prêt ! Génération de l\'introduction...')

      const introAudio = await this.ttsService.generateAudio({
        text: `Bienvenue dans cette leçon sur ${lessonPlan.title}. ${lessonPlan.description}`
      })
      const introUrl = await this.ttsService['saveAudioFile'](introAudio, 'intro')

      const currentContent = typeof lesson.content === 'string'
        ? JSON.parse(lesson.content || '{}')
        : lesson.content || {}
      const partialContent = {
        ...currentContent,
        audioFiles: { intro: introUrl }
      }

      lesson.content = JSON.stringify(partialContent)
      lesson.status = 'intro_ready'
      await lesson.save()

      await WebSocketService.sendProgress(lessonId, 50, 'Introduction prête ! Vous pouvez commencer...')

      this.generateRemainingContent(lessonId, lessonPlan).catch(error => {
        console.error('Erreur génération contenu restant:', error)
      })

    } catch (error) {
      console.error(`Erreur génération leçon ${lessonId}:`, error)

      const lesson = await Lesson.find(lessonId)
      if (lesson) {
        lesson.status = 'draft'
        await lesson.save()
      }

      await WebSocketService.sendLessonError(lessonId, error.message)

      throw error
    }
  }

  private async generateRemainingContent(lessonId: number, lessonPlan: LessonPlan): Promise<void> {
    try {
      console.log(`Génération du contenu restant pour la leçon ${lessonId}`)

      const currentLesson = await Lesson.findOrFail(lessonId)
      const currentContent = typeof currentLesson.content === 'string'
        ? JSON.parse(currentLesson.content || '{}')
        : currentLesson.content || {}

      const remainingImageQueries: string[] = []
      const imageQueryMap: { [key: string]: { sectionIndex: number, subsectionIndex: number } } = {}

      lessonPlan.sections.forEach((section, sectionIndex) => {
        if (sectionIndex > 0) {
          section.subsections.forEach((subsection, subsectionIndex) => {
            remainingImageQueries.push(subsection.imageQuery)
            imageQueryMap[subsection.imageQuery] = { sectionIndex, subsectionIndex }
          })
        }
      })

      console.log(`Récupération de ${remainingImageQueries.length} images restantes...`)
      const [remainingImages] = await Promise.all([
        this.wikipediaService.getMultipleImages(remainingImageQueries),
        WebSocketService.sendProgress(lessonId, 60, 'Images en cours...')
      ])

      const validImages = remainingImages.filter(img => img !== null)
      console.log(`Optimisation de ${validImages.length} images valides...`)
      const [optimizedImages] = await Promise.all([
        this.cloudinaryService.optimizeImages(validImages),
        WebSocketService.sendProgress(lessonId, 70, 'Optimisation...')
      ])

      let optimizedIndex = 0
      const generatedLesson: GeneratedLesson = {
        ...lessonPlan,
        sections: lessonPlan.sections.map((section, sectionIndex) => {
          const existingSection = currentContent.sections?.[sectionIndex]
          const sectionId = existingSection?.id || section.id || crypto.randomUUID()

          return {
            ...section,
            id: sectionId,
            subsections: section.subsections.map((subsection, subsectionIndex) => {
              if (sectionIndex === 0 && currentContent.sections && currentContent.sections[0]) {
                const existingSubsection = currentContent.sections[0].subsections[subsectionIndex]
                return {
                  ...subsection,
                  image: existingSubsection?.image || undefined
                }
              }

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
          }
        })
      }

      await WebSocketService.sendProgress(lessonId, 80, 'Génération audio des sections...')
      const audioFiles = await this.ttsService.generateLessonAudio(generatedLesson)

      const finalLesson = {
        ...generatedLesson,
        audioFiles
      }

      const lesson = await Lesson.findOrFail(lessonId)
      lesson.content = JSON.stringify(finalLesson)
      lesson.status = 'ready'
      await lesson.save()

      await WebSocketService.sendLessonReady(lessonId, finalLesson)
      await WebSocketService.sendLessonReady(lessonId, finalLesson)

      console.log(`Leçon ${lessonId} complètement générée avec succès`)

    } catch (error) {
      console.error(`Erreur génération contenu restant ${lessonId}:`, error)
      await WebSocketService.sendLessonError(lessonId, error.message)
    }
  }
}