import transmit from '@adonisjs/transmit/services/main'

export interface LessonUpdate {
  lessonId: number
  status: 'processing' | 'ready' | 'error'
  progress?: number
  message?: string
  data?: any
}

export class WebSocketService {
  /**
   * Envoyer une mise à jour de leçon à tous les clients connectés
   */
  static async sendLessonUpdate(update: LessonUpdate) {
    try {
      await transmit.broadcast(`lesson.${update.lessonId}`, {
        type: 'lesson_update',
        ...update,
        timestamp: new Date().toISOString()
      })
      
      console.log(`WebSocket: Mise à jour envoyée pour la leçon ${update.lessonId}`)
    } catch (error) {
      console.error('Erreur WebSocket:', error)
    }
  }

  /**
   * Envoyer une mise à jour de progression
   */
  static async sendProgress(lessonId: number, progress: number, message: string) {
    await this.sendLessonUpdate({
      lessonId,
      status: 'processing',
      progress,
      message
    })
  }

  /**
   * Notifier qu'une leçon est prête
   */
  static async sendLessonReady(lessonId: number, lessonData: any) {
    await this.sendLessonUpdate({
      lessonId,
      status: 'ready',
      progress: 100,
      message: 'Leçon générée avec succès',
      data: lessonData
    })
  }

  /**
   * Notifier une erreur
   */
  static async sendLessonError(lessonId: number, error: string) {
    await this.sendLessonUpdate({
      lessonId,
      status: 'error',
      message: error
    })
  }
}