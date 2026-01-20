import { Readable } from 'stream'
import type { HttpContext } from '@adonisjs/core/http'
import { TTSService } from '#services/tts_service'
import { generateAudioValidator } from '#validators/audio'

export default class AudioController {
  /**
   * Générer de l'audio en streaming pour un texte donné
   */
  async generateStream({ request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(generateAudioValidator)
      const { text, voice = 'fr-FR-Neural2-A' } = payload

      if (!text) {
        return response.status(400).json({
          success: false,
          message: 'Le texte est requis'
        })
      }

      const ttsService = new TTSService()
      const audioBuffer = await ttsService.generateAudio({
        text,
        voiceName: voice
      })

      response.header('Content-Type', 'audio/mpeg')
      response.header('Content-Length', audioBuffer.length.toString())
      response.header('Accept-Ranges', 'bytes')
      response.header('Cache-Control', 'public, max-age=3600')

      return response.stream(Readable.from(audioBuffer))
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la génération audio',
        error: error.message
      })
    }
  }

  /**
   * Obtenir l'URL Cloudinary d'un audio généré
   */
  async getAudioUrl({ request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(generateAudioValidator)
      const { text, voice = 'fr-FR-Neural2-A' } = payload

      if (!text) {
        return response.status(400).json({
          success: false,
          message: 'Le texte est requis'
        })
      }

      const ttsService = new TTSService()
      const audioBuffer = await ttsService.generateAudio({
        text,
        voiceName: voice
      })

      const filename = `stream_${Date.now()}`
      const audioUrl = await ttsService['saveAudioFile'](audioBuffer, filename)

      return response.json({
        success: true,
        data: {
          audioUrl,
          text,
          voice
        }
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la génération audio',
        error: error.message
      })
    }
  }
}