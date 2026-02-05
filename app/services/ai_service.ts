import { GoogleGenerativeAI } from '@google/generative-ai'
import env from '#start/env'

export interface LessonPlan {
  title: string
  description: string
  sections: {
    title: string
    subsections: {
      title: string
      content: string
      imageQuery: string
    }[]
    id?: string
    check_understanding?: boolean
  }[]
  conclusion: string
}

export class AiService {
  private genAI: GoogleGenerativeAI

  constructor() {
    this.genAI = new GoogleGenerativeAI(env.get('GOOGLE_GENERATIVE_AI_API_KEY'))
  }

  getGeminiModel() {
    return this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ googleSearch: {} } as any],
    })
  }

  async generateLessonPlan(title: string, userProfile?: {
    profileType: string
    educationLevel?: string
    specialty?: string
    country?: string
    institutionName?: string
    series?: string
    studyYear?: string
  }): Promise<LessonPlan> {
    const model = this.getGeminiModel()

    const { profileType, educationLevel, specialty, country, institutionName, series, studyYear } = userProfile || {}

    // Construction du Prompt Maître V6 : Génération de Plan Académique Certifié
    const prompt = `
Agis en tant qu'expert en ingénierie pédagogique et spécialiste des systèmes éducatifs internationaux. Ta mission est de concevoir un plan de cours 100% conforme à la réalité scolaire de l'élève.

1. ANALYSE ET IDENTIFICATION
• Analyse le titre saisi : '${title}'.
• Détermine précisément la Matière Scolaire correspondante pour le profil suivant : ${profileType === 'pupil' ? `Élève de ${educationLevel} ${series || ''}` : `Étudiant ${institutionName ? `à ${institutionName}` : ''} en ${specialty || ''} (${studyYear || ''})`} au ${country || 'International'}.

2. RECHERCHE WEB EN TEMPS RÉEL (GOOGLE SEARCH)
• Effectue une recherche approfondie pour trouver le programme officiel national ou le référentiel pédagogique du Ministère de l'Éducation ${country ? `du ${country}` : ''} pour cette matière et ce niveau.
• Cherche les sommaires de manuels scolaires agréés ou les fiches de cours officielles du pays.

3. EXTRACTION ET MAPPING (PRIORITÉ À LA SOURCE)
• Si une source officielle est trouvée : Extrais et recopie fidèlement la structure du chapitre correspondant à '${title}'. Tu DOIS utiliser les intitulés exacts du ministère.
• Si le titre est approximatif : Identifie le chapitre officiel qui s'en rapproche le plus (le 'Parent Topic').
• Si aucune source n'est accessible : Synthétise un plan basé sur les standards académiques stricts du pays, mais privilégie toujours l'extraction de données réelles du web.

4. STRUCTURE PÉDAGOGIQUE DU PLAN
Génère le plan selon l'arborescence suivante :
• Introduction de la leçon.
• Grandes Parties (titres officiels).
• Sous-parties pour chaque Grande Partie (détails des leçons).
• Conclusion de la leçon.

5. FORMAT DE SORTIE ET CONTRAINTES
• Réponds exclusivement en suivant la structure JSON de référence fournie.
• Interdiction formelle : Ne pas inventer de chapitres hors programme.
• Le titre final de la leçon dans le JSON doit être l'intitulé académique officiel trouvé lors de la recherche.
`

    // Retry with exponential backoff + jitter for transient errors (429, 503)
    let lastError: any
    const maxAttempts = 5
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`Génération avec Google AI pour: ${title} (tentative ${attempt}/${maxAttempts})`)
        const result = await model.generateContent(prompt)
        const response = await result.response
        const text = response.text()

        console.log('Réponse AI reçue:', text.substring(0, 200) + '...')

        // Nettoyer la réponse pour extraire le JSON
        let cleanText = text.trim()

        // Supprimer balises markdown de début (```json, ```JSON, ```, etc)
        cleanText = cleanText.replace(/^```[a-zA-Z]*\s*/, '')

        // Supprimer balises markdown de fin (```)
        cleanText = cleanText.replace(/```$/, '')

        // Algorithme de recherche du premier objet JSON complet par équilibrage des accolades
        const firstOpen = cleanText.indexOf('{')

        if (firstOpen !== -1) {
          let balance = 0
          let inString = false
          let escape = false
          let endIndex = -1

          for (let i = firstOpen; i < cleanText.length; i++) {
            const char = cleanText[i]

            if (inString) {
              if (escape) {
                escape = false
              } else if (char === '\\') {
                escape = true
              } else if (char === '"') {
                inString = false
              }
            } else {
              if (char === '"') {
                inString = true
              } else if (char === '{') {
                balance++
              } else if (char === '}') {
                balance--
                if (balance === 0) {
                  endIndex = i
                  break
                }
              }
            }
          }

          if (endIndex !== -1) {
            cleanText = cleanText.substring(firstOpen, endIndex + 1)
          } else {
            // Fallback si pas équilibré (ex: coupé)
            console.warn('JSON non équilibré détecté, tentative avec le reste du texte')
            cleanText = cleanText.substring(firstOpen)
          }
        } else {
          console.error('Pas de JSON valide trouvé dans:', text)
          throw new Error('Format de réponse invalide (pas de JSON détecté)')
        }

        const parsed: LessonPlan = JSON.parse(cleanText)

        // Validation de la structure
        if (!parsed.sections || !Array.isArray(parsed.sections)) {
          console.warn('⚠️ JSON invalide reçu (pas de sections):', cleanText.substring(0, 200) + '...')
          throw new Error('Format de réponse invalide: "sections" manquant ou incorrect')
        }

        // Validation et correction des imageQuery manquantes
        if (parsed.sections) {
          parsed.sections.forEach(section => {
            if (section.subsections) {
              section.subsections.forEach(subsection => {
                if (!subsection.imageQuery || subsection.imageQuery.trim() === '' || subsection.imageQuery === 'undefined') {
                  console.warn(`⚠️ imageQuery manquant pour "${subsection.title}", utilisation du titre comme fallback`)
                  // Utiliser le titre de la sous-partie ou de la section comme fallback
                  // Retirer les mots trop communs pour une recherche Wikipedia plus efficace
                  subsection.imageQuery = subsection.title || section.title
                }
              })
            }
          })
        }

        console.log('JSON parsé et validé avec succès')
        return parsed
      } catch (error: any) {
        lastError = error
        // try to detect HTTP status
        const status = error?.status || error?.code || (error?.response && error.response.status) || null
        console.error(`Erreur génération AI (tentative ${attempt}/${maxAttempts}):`, error?.message || error)

        // Retry on Rate Limit (429), Service Unavailable (503), OR JSON Syntax Error
        const isTransient = status === 429 || status === 503
        const isJsonError = error instanceof SyntaxError || error.message.includes('JSON') || error.message.includes('Format de réponse invalide')

        if ((isTransient || isJsonError) && attempt < maxAttempts) {
          // Prefer Retry-After header if available
          let waitTime = null
          try {
            const retryAfter = error?.response?.headers?.['retry-after'] || error?.headers?.['retry-after'] || null
            if (retryAfter) {
              const sec = parseInt(retryAfter, 10)
              if (!Number.isNaN(sec)) waitTime = sec * 1000
            }
          } catch (e) {
            // ignore
          }

          if (!waitTime) {
            // exponential backoff base 1000ms with jitter
            const base = 1000 * Math.pow(2, attempt - 1)
            const jitter = Math.floor(Math.random() * 1000)
            waitTime = base + jitter
          }

          console.log(`⏳ Attente de ${waitTime}ms avant nouvelle tentative (cause: ${isTransient ? 'API' : 'JSON'})...`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
          continue
        }

        // For other errors or if out of attempts, break and throw below
        break
      }
    }

    console.error(`Erreur génération AI après ${maxAttempts} tentatives:`, lastError)
    throw new Error('Impossible de générer le plan de cours: ' + (lastError?.message || lastError))
  }
}