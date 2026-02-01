import type { HttpContext } from '@adonisjs/core/http'
import Lesson from '#models/lesson'
import UserProfile from '#models/user_profile'
import { createLessonValidator } from '#validators/lesson'
import { LessonGeneratorService } from '#services/lesson_generator_service'

export default class LessonsController {
  /**
   * Créer une nouvelle leçon
   */
  async create({ request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(createLessonValidator)

      const deviceId = request.header('X-Device-Id') || request.input('deviceId')

      const lesson = await Lesson.create({
        title: payload.title,
        status: 'processing',
        deviceId: deviceId
      })

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
            console.log(`Profil trouvé pour deviceId ${deviceId}:`, userProfile)
          } else {
            console.log(`Aucun profil trouvé pour deviceId ${deviceId}`)
          }
        } catch (error) {
          console.error('Erreur récupération profil:', error)
        }
      }

      const generatorService = new LessonGeneratorService()

      generatorService.generateLesson(lesson.id, lesson.title, userProfile).catch(error => {
        console.error('Erreur génération leçon:', error)
      })

      return response.status(201).json({
        success: true,
        data: lesson,
        message: 'Leçon créée, génération en cours...'
      })
    } catch (error) {
      return response.status(400).json({
        success: false,
        message: 'Erreur lors de la création de la leçon',
        error: error.message
      })
    }
  }

  /**
   * Récupérer une leçon par ID
   */
  async show({ params, response }: HttpContext) {
    try {
      const lesson = await Lesson.findOrFail(params.id)

      return response.json({
        success: true,
        data: lesson
      })
    } catch (error) {
      return response.status(404).json({
        success: false,
        message: 'Leçon non trouvée'
      })
    }
  }

  /**
   * Lister toutes les leçons
   */
  async index({ request, response }: HttpContext) {
    try {
      const deviceId = request.header('X-Device-Id') || request.input('deviceId')

      const query = Lesson.query()

      if (deviceId) {
        query.where('deviceId', deviceId)
      }

      const lessons = await query.exec()

      return response.json({
        success: true,
        data: lessons
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des leçons'
      })
    }
  }

  /**
   * Créer une leçon de test avec contenu fictif
   */
  async createTest({ request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(createLessonValidator)

      const testContent = {
        title: payload.title,
        description: `Cours complet sur ${payload.title}`,
        sections: [
          {
            title: "Introduction",
            subsections: [
              {
                title: "Qu'est-ce que " + payload.title + " ?",
                content: "Explication détaillée du concept...",
                imageQuery: payload.title.toLowerCase(),
                image: {
                  url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Earth_Eastern_Hemisphere.jpg/256px-Earth_Eastern_Hemisphere.jpg",
                  title: "Image d'exemple",
                  description: "Description de l'image"
                }
              }
            ]
          }
        ],
        conclusion: "En conclusion, nous avons appris..."
      }

      const lesson = await Lesson.create({
        title: payload.title,
        description: testContent.description,
        plan: JSON.stringify({ sections: testContent.sections.map(s => ({ title: s.title })) }),
        content: JSON.stringify(testContent),
        status: 'ready',
        deviceId: request.header('X-Device-Id') || request.input('deviceId')
      })

      return response.status(201).json({
        success: true,
        data: lesson,
        message: 'Leçon de test créée avec succès'
      })
    } catch (error) {
      return response.status(400).json({
        success: false,
        message: 'Erreur lors de la création de la leçon de test',
        error: error.message
      })
    }
  }
}