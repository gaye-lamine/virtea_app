import type { HttpContext } from '@adonisjs/core/http'
import LessonProgress from '#models/lesson_progress'
import { DateTime } from 'luxon'

export default class LessonProgressesController {
  /**
   * Récupérer la progression d'une leçon pour un utilisateur
   */
  async show({ params, request, response }: HttpContext) {
    try {
      const deviceId = request.header('x-device-id')
      if (!deviceId) {
        return response.badRequest({ error: 'Device ID requis' })
      }

      const progress = await LessonProgress.query()
        .where('lesson_id', params.lessonId)
        .where('device_id', deviceId)
        .first()

      if (!progress) {
        return response.ok({ 
          data: {
            currentStep: 0,
            totalSteps: 0,
            completed: false
          }
        })
      }

      return response.ok({ 
        data: {
          currentStep: progress.currentSectionIndex,
          totalSteps: progress.completedSections?.length || 0,
          completed: progress.isCompleted,
          ...progress.toJSON()
        }
      })
    } catch (error) {
      console.error('Erreur récupération progression:', error)
      return response.badRequest({ error: 'Impossible de récupérer la progression' })
    }
  }

  /**
   * Mettre à jour la progression
   */
  async update({ params, request, response }: HttpContext) {
    try {
      console.log('📥 Requête progression reçue:', {
        lessonId: params.lessonId,
        headers: request.headers(),
        body: request.body()
      })
      
      const deviceId = request.header('x-device-id')
      console.log('Device ID:', deviceId)
      
      if (!deviceId) {
        console.log('❌ Device ID manquant')
        return response.badRequest({ error: 'Device ID requis' })
      }

      const data = request.only([
        'currentStep',
        'totalSteps',
        'completed',
        'currentSectionIndex',
        'currentSubsectionIndex',
        'completedSections',
        'isCompleted',
      ])
      
      console.log('Données reçues:', data)

      let progress = await LessonProgress.query()
        .where('lesson_id', params.lessonId)
        .where('device_id', deviceId)
        .first()

      if (!progress) {
        // Créer nouvelle progression
        progress = await LessonProgress.create({
          lessonId: params.lessonId,
          deviceId,
          currentSectionIndex: data.currentStep || data.currentSectionIndex || 0,
          currentSubsectionIndex: data.currentSubsectionIndex || 0,
          completedSections: data.completedSections || [],
          isCompleted: data.completed || data.isCompleted || false,
          lastReviewedAt: DateTime.now(),
          nextReviewAt: DateTime.now().plus({ days: 2 }), // Révision dans 2 jours
        })
      } else {
        // Mettre à jour
        if (data.currentStep !== undefined) {
          progress.currentSectionIndex = data.currentStep
        }
        if (data.currentSectionIndex !== undefined) {
          progress.currentSectionIndex = data.currentSectionIndex
        }
        if (data.currentSubsectionIndex !== undefined) {
          progress.currentSubsectionIndex = data.currentSubsectionIndex
        }
        if (data.completedSections !== undefined) {
          progress.completedSections = data.completedSections
        }
        if (data.completed !== undefined) {
          progress.isCompleted = data.completed
        }
        if (data.isCompleted !== undefined) {
          progress.isCompleted = data.isCompleted
        }
        
        progress.lastReviewedAt = DateTime.now()
        
        // Calculer prochaine révision (révision espacée)
        const reviewIntervals = [2, 7, 14, 30] // jours
        const nextInterval = reviewIntervals[Math.min(progress.reviewCount, reviewIntervals.length - 1)]
        progress.nextReviewAt = DateTime.now().plus({ days: nextInterval })
        progress.reviewCount += 1
        
        await progress.save()
      }

      return response.ok({ data: progress })
    } catch (error) {
      console.error('Erreur mise à jour progression:', error)
      return response.badRequest({ error: 'Impossible de mettre à jour la progression' })
    }
  }

  /**
   * Récupérer toutes les progressions d'un utilisateur
   */
  async index({ request, response }: HttpContext) {
    try {
      const deviceId = request.header('x-device-id')
      if (!deviceId) {
        return response.badRequest({ error: 'Device ID requis' })
      }

      const progresses = await LessonProgress.query()
        .where('device_id', deviceId)
        .preload('lesson')
        .orderBy('updated_at', 'desc')

      return response.ok({ data: progresses })
    } catch (error) {
      console.error('Erreur récupération progressions:', error)
      return response.badRequest({ error: 'Impossible de récupérer les progressions' })
    }
  }
}
