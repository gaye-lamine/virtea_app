import type { HttpContext } from '@adonisjs/core/http'
import { QAGeneratorService } from '#services/qa_generator_service'

export default class SectionQuestionsController {
    /**
     * Poser une question sur une section spécifique
     */
    async store({ request, response, params }: HttpContext) {
        try {
            const { lesson_id, section_id } = params
            const { question } = request.body()

            if (!question) {
                return response.status(400).json({
                    success: false,
                    message: 'La question est requise'
                })
            }

            const qaService = new QAGeneratorService()

            // Récupérer le profil utilisateur via le device ID 
            // const deviceId = request.header('X-Device-Id')
            // const userProfile = await UserProfile.findBy('deviceId', deviceId)

            const answer = await qaService.answerSectionQuestion(
                lesson_id,
                section_id,
                question
            )

            return response.json({
                success: true,
                data: answer
            })

        } catch (error) {
            console.error('Erreur SectionQuestionsController:', error)
            return response.status(500).json({
                success: false,
                message: 'Impossible de traiter la question',
                error: error.message
            })
        }
    }
}
