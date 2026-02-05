import type { HttpContext } from '@adonisjs/core/http'
import AcademicSuggestionsService from '#services/academic_suggestions_service'

export default class SuggestionsController {

    /**
     * @handle
     * @requestBody {"country": "string", "university": "string"}
     * @responseBody 200 - <string[]>
     */
    async handle({ request, response }: HttpContext) {
        const payload = request.only(['country', 'university'])
        const suggestions = await AcademicSuggestionsService.getSuggestions(payload)
        return response.ok(suggestions)
    }
}
