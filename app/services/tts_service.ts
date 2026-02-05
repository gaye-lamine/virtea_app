import { TextToSpeechClient } from '@google-cloud/text-to-speech'
import { v2 as cloudinary } from 'cloudinary'
import env from '#start/env'

export interface TTSOptions {
  text: string
  languageCode?: string
  voiceName?: string
  modelName?: string
  audioEncoding?: 'MP3' | 'LINEAR16' | 'OGG_OPUS'
}

export class TTSService {
  private client: TextToSpeechClient

  constructor() {
    // Support multiple ways of providing credentials in prod:
    // - GOOGLE_CLOUD_CREDENTIALS as JSON
    // - GOOGLE_CLOUD_CREDENTIALS as base64-encoded JSON
    // - GOOGLE_CLOUD_CREDENTIALS_BASE64 as base64-encoded JSON
    let credentialsObj: any = undefined
    try {
      const raw = env.get('GOOGLE_CLOUD_CREDENTIALS')
      try {
        credentialsObj = JSON.parse(raw)
      } catch (err) {
        // maybe base64 encoded in the same var
        try {
          const decoded = Buffer.from(raw, 'base64').toString('utf8')
          credentialsObj = JSON.parse(decoded)
        } catch (err2) {
          // ignore, we'll try GOOGLE_CLOUD_CREDENTIALS_BASE64 next
        }
      }
    } catch (err) {
      // env.get may throw if not present; ignore and try base64 var
    }

    if (!credentialsObj && process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64) {
      try {
        const decoded = Buffer.from(process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64, 'base64').toString('utf8')
        credentialsObj = JSON.parse(decoded)
      } catch (err) {
        console.error('Failed to parse GOOGLE_CLOUD_CREDENTIALS_BASE64:', err.message)
      }
    }

    const clientConfig: any = {}
    const projectId = env.get('GOOGLE_CLOUD_PROJECT_ID')
    if (projectId) clientConfig.projectId = projectId
    if (credentialsObj) clientConfig.credentials = credentialsObj

    this.client = new TextToSpeechClient(clientConfig)

    // Configuration Cloudinary
    cloudinary.config({
      cloud_name: env.get('CLOUDINARY_CLOUD_NAME'),
      api_key: env.get('CLOUDINARY_API_KEY'),
      api_secret: env.get('CLOUDINARY_API_SECRET')
    })
  }

  /**
   * Normalise le texte pour améliorer la synthèse vocale
   * - Remplace les apostrophes typographiques par des apostrophes droites
   * - Nettoie les caractères problématiques
   */
  private normalizeTextForTTS(text: string): string {
    return text
      // Utiliser l'apostrophe droite standard pour une meilleure compatibilité TTS
      // (Les apostrophes typographiques ’ peuvent causer des pauses incorrectes genre "L... être")
      .replace(/[‘’`]/g, "'")
      // Remplacer les guillemets typographiques par des guillemets droits
      .replace(/[“”«»]/g, '"')
      // Normaliser les espaces multiples
      .replace(/\s+/g, ' ')
      // Supprimer les espaces avant la ponctuation
      .replace(/\s+([.,!?;:])/g, '$1')
      .trim()
  }

  async generateAudio(options: TTSOptions): Promise<Buffer> {
    const {
      text,
      languageCode = 'fr-FR',
      voiceName = 'fr-FR-Chirp3-HD-Zubenelgenubi',
      modelName = 'gemini-2.5-flash-tts',
      audioEncoding = 'MP3'
    } = options

    try {
      // Normaliser le texte avant la synthèse
      const normalizedText = this.normalizeTextForTTS(text)

      const request: any = { // Cast to any to allow model_name if missing from types
        input: { text: normalizedText },
        voice: {
          languageCode,
          name: voiceName
          // ssmlGender is inferred from the voice name
        },
        audioConfig: {
          audioEncoding: audioEncoding as any
        }
      }

      // Inject model_name dynamically if present (required for Gemini/Chirp Voices)
      if (modelName) {
        // @ts-ignore
        request.voice.model = modelName // The doc uses 'model' or 'model_name' depending on library version, sometimes just in voice object but key checks might be strict.
        // Based on doc 'model: "gemini-2.5-flash-tts"' looks like a property of the config or voice.
        // Actually the curl example shows voice: { ..., "model_name": "gemini-2.5-flash-tts" } 
        // BUT ALSO "model": "gemini-..." in other contexts. Let's try inserting it into voice object.
        request.voice.model_name = modelName
      }

      const [response] = await this.client.synthesizeSpeech(request)

      if (!response.audioContent) {
        throw new Error('Aucun contenu audio généré')
      }

      return Buffer.from(response.audioContent as Uint8Array)
    } catch (error) {
      console.error('Erreur TTS:', error)
      throw new Error('Impossible de générer l\'audio: ' + error.message)
    }
  }

  async generateLessonAudio(lessonContent: any): Promise<{ [key: string]: string }> {
    try {
      // Préparer toutes les tâches audio en parallèle
      const audioTasks: Array<{ key: string, text: string }> = []

      // Audio d'introduction
      audioTasks.push({
        key: 'intro',
        text: `Bienvenue dans cette leçon sur ${lessonContent.title}. ${lessonContent.description}`
      })

      // Audio pour chaque section et sous-section
      lessonContent.sections.forEach((section: any, i: number) => {
        // Audio d'introduction de section
        audioTasks.push({
          key: `section_${i}_intro`,
          text: `Nous allons maintenant aborder ${section.title}`
        })

        // Audio pour chaque sous-section
        section.subsections.forEach((subsection: any, j: number) => {
          audioTasks.push({
            key: `section_${i}_subsection_${j}`,
            text: subsection.content
          })
        })
      })

      // Audio de conclusion
      if (lessonContent.conclusion) {
        audioTasks.push({
          key: 'conclusion',
          text: lessonContent.conclusion
        })
      }

      console.log(`🚀 Génération de ${audioTasks.length} fichiers audio en parallèle...`)

      // Générer tous les audios en parallèle (par batch de 5 pour ne pas surcharger)
      const batchSize = 5
      const audioFiles: { [key: string]: string } = {}

      for (let i = 0; i < audioTasks.length; i += batchSize) {
        const batch = audioTasks.slice(i, i + batchSize)
        const batchResults = await Promise.all(
          batch.map(async (task) => {
            const audio = await this.generateAudio({ text: task.text })
            const url = await this.saveAudioFile(audio, task.key)
            return { key: task.key, url }
          })
        )

        batchResults.forEach(result => {
          audioFiles[result.key] = result.url
        })

        console.log(`✅ Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(audioTasks.length / batchSize)} terminé`)
      }

      return audioFiles
    } catch (error) {
      console.error('Erreur génération audio leçon:', error)
      throw error
    }
  }

  /**
   * Supprimer les fichiers audio d'une leçon de Cloudinary
   */
  async deleteAudioFiles(audioUrls: string[]): Promise<void> {
    try {
      const deletePromises = audioUrls.map(async (url) => {
        // Extraire le public_id de l'URL Cloudinary
        const publicId = this.extractPublicIdFromUrl(url)
        if (publicId) {
          await cloudinary.uploader.destroy(publicId, { resource_type: 'video' })
        }
      })

      await Promise.all(deletePromises)
      console.log('Fichiers audio supprimés de Cloudinary')
    } catch (error) {
      console.error('Erreur suppression audio:', error)
    }
  }

  private extractPublicIdFromUrl(url: string): string | null {
    try {
      // Extraire le public_id d'une URL Cloudinary
      const match = url.match(/\/lessons\/audio\/([^.]+)/)
      return match ? `lessons/audio/${match[1]}` : null
    } catch (error) {
      return null
    }
  }

  private async saveAudioFile(audioBuffer: Buffer, filename: string): Promise<string> {
    try {
      // Convertir le buffer en base64 pour l'upload Cloudinary
      const base64Audio = `data:audio/mp3;base64,${audioBuffer.toString('base64')}`

      // Upload vers Cloudinary avec optimisation web
      const result = await cloudinary.uploader.upload(base64Audio, {
        resource_type: 'video', // Cloudinary utilise 'video' pour les fichiers audio
        folder: 'lessons/audio',
        public_id: `${filename}_${Date.now()}`,
        format: 'mp3',
        transformation: [
          {
            quality: 'auto',
            audio_codec: 'mp3',
            bit_rate: '128k', // Bitrate optimisé pour le web
            audio_frequency: 44100 // Fréquence standard
          }
        ]
      })

      console.log(`Audio uploadé vers Cloudinary: ${result.secure_url}`)
      return result.secure_url
    } catch (error) {
      console.error('Erreur upload audio Cloudinary:', error)
      throw new Error('Impossible d\'uploader l\'audio: ' + error.message)
    }
  }
}