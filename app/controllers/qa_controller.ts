import type { HttpContext } from '@adonisjs/core/http'
import Lesson from '#models/lesson'
import UserProfile from '#models/user_profile'
import { QAGeneratorService } from '#services/qa_generator_service'

export default class QAController {
  private qaService: QAGeneratorService

  constructor() {
    this.qaService = new QAGeneratorService()
  }

  /**
   * Générer une session Q&A pour une leçon
   */
  async generate({ request, response }: HttpContext) {
    try {
      const { lessonId, title, content } = request.only(['lessonId', 'title', 'content'])
      const deviceId = request.header('X-Device-Id')

      if (!lessonId || !title || !content) {
        return response.status(400).json({
          success: false,
          message: 'lessonId, title et content sont requis'
        })
      }

      let userProfile: { profileType: string; educationLevel?: string; specialty?: string } | undefined
      if (deviceId) {
        try {
          const profile = await UserProfile.query().where('deviceId', deviceId).first()
          if (profile) {
            userProfile = {
              profileType: profile.profileType,
              educationLevel: profile.educationLevel || undefined,
              specialty: profile.specialty || undefined
            }
            console.log(`Profil trouvé pour Q&A deviceId ${deviceId}:`, userProfile)
          }
        } catch (error) {
          console.error('Erreur récupération profil Q&A:', error)
        }
      }

      const qaSession = await this.qaService.generateQASession(
        parseInt(lessonId),
        title,
        content,
        userProfile
      )

      return response.status(201).json({
        success: true,
        data: qaSession,
        message: 'Session Q&A générée avec succès'
      })
    } catch (error) {
      console.error('Erreur génération Q&A:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la génération de la session Q&A',
        error: error.message
      })
    }
  }

  /**
   * Répondre à une question personnalisée
   */
  async ask({ request, response }: HttpContext) {
    try {
      const { lessonId, question } = request.only(['lessonId', 'question'])
      const deviceId = request.header('X-Device-Id')

      if (!lessonId || !question) {
        return response.status(400).json({
          success: false,
          message: 'lessonId et question sont requis'
        })
      }

      const lesson = await Lesson.findOrFail(lessonId)
      let lessonContent = null

      if (lesson.content) {
        try {
          lessonContent = typeof lesson.content === 'string'
            ? JSON.parse(lesson.content)
            : lesson.content
        } catch (error) {
          console.error('Erreur parsing contenu leçon:', error)
          return response.status(400).json({
            success: false,
            message: 'Contenu de la leçon invalide'
          })
        }
      }

      if (!lessonContent) {
        return response.status(400).json({
          success: false,
          message: 'Contenu de la leçon non disponible'
        })
      }

      let userProfile: { profileType: string; educationLevel?: string; specialty?: string } | undefined
      if (deviceId) {
        try {
          const profile = await UserProfile.query().where('deviceId', deviceId).first()
          if (profile) {
            userProfile = {
              profileType: profile.profileType,
              educationLevel: profile.educationLevel || undefined,
              specialty: profile.specialty || undefined
            }
          }
        } catch (error) {
          console.error('Erreur récupération profil question:', error)
        }
      }

      const answer = await this.qaService.answerCustomQuestion(
        parseInt(lessonId),
        question,
        lessonContent,
        userProfile
      )

      return response.json({
        success: true,
        answer: answer,
        message: 'Réponse générée avec succès'
      })
    } catch (error) {
      console.error('Erreur réponse question:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la génération de la réponse',
        error: error.message
      })
    }
  }

  /**
   * Récupérer les sessions Q&A sauvegardées (dinako deff apres )
   */
  async sessions({ response }: HttpContext) {
    try {
      // const deviceId = request.header('X-Device-Id')

      // Pour l'instant, retourner une liste vide
      // TODO: Implémenter la sauvegarde des sessions Q&A en base
      return response.json({
        success: true,
        data: [],
        message: 'Sessions Q&A récupérées'
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des sessions Q&A'
      })
    }
  }
}