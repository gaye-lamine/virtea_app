import type { HttpContext } from '@adonisjs/core/http'
import Lesson from '#models/lesson'
import UserProfile from '#models/user_profile'
import { QuizGeneratorService } from '#services/quiz_generator_service'

export default class QuizController {
  private quizService: QuizGeneratorService

  constructor() {
    this.quizService = new QuizGeneratorService()
  }

  /**
   * Générer un quiz pour une leçon
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

      // Récupérer le profil utilisateur si deviceId est fourni
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
            console.log(`Profil trouvé pour Quiz deviceId ${deviceId}:`, userProfile)
          }
        } catch (error) {
          console.error('Erreur récupération profil Quiz:', error)
        }
      }

      const quiz = await this.quizService.generateQuiz(
        parseInt(lessonId), 
        title, 
        content,
        userProfile
      )

      return response.status(201).json({
        success: true,
        data: quiz,
        message: 'Quiz généré avec succès'
      })
    } catch (error) {
      console.error('Erreur génération Quiz:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la génération du quiz',
        error: error.message
      })
    }
  }

  /**
   * Récupérer les quiz sauvegardés (placeholder pour future implémentation)
   */
  async index({ request, response }: HttpContext) {
    try {
      const deviceId = request.header('X-Device-Id')
      
      // Pour l'instant, retourner une liste vide
      // TODO: Implémenter la sauvegarde des quiz en base
      return response.json({
        success: true,
        data: [],
        message: 'Quiz récupérés'
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des quiz'
      })
    }
  }
}