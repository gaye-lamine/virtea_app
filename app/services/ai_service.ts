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

    // Adapter le niveau et le style selon le profil
    let audienceContext = ''
    let searchContext = ''

    if (userProfile) {
      const { profileType, educationLevel, specialty, country, institutionName, series, studyYear } = userProfile

      // 1. Contexte de Recherche (Grounding)
      if (country) {
        if (profileType === 'student') {
          // Contexte Étudiant (Université/Grande École)
          const univContext = institutionName ? `de l'université/école "${institutionName}"` : ''
          const filiereContext = specialty ? `en filière "${specialty}"` : ''
          const anneeContext = studyYear ? `niveau "${studyYear}"` : ''

          searchContext = `
CONTEXTE ACADÉMIQUE SPÉCIFIQUE :
L'apprenant est un étudiant ${univContext} ${filiereContext} ${anneeContext} au ${country}.
TÂCHE DE RECHERCHE OBLIGATOIRE :
Utilise Google Search pour trouver le programme officiel ou le syllabus standard pour le cours "${title}" correspondant exactement à ce niveau universitaire et cette filière au ${country}.
Base la structure du cours sur ce programme officiel.
`
        } else {
          // Contexte Élève (Lycée/Collège)
          const niveauContext = educationLevel ? `niveau "${educationLevel}"` : ''
          const serieContext = series ? `série/filière "${series}"` : ''

          searchContext = `
CONTEXTE SCOLAIRE SPÉCIFIQUE :
L'apprenant est un élève ${niveauContext} ${serieContext} au ${country}.
TÂCHE DE RECHERCHE OBLIGATOIRE :
Utilise Google Search pour trouver le programme scolaire officiel national du ${country} pour la matière concernée par "${title}" à ce niveau spécifique (${educationLevel} ${series}).
Le plan de cours DOIT correspondre strictement aux chapitres/compétences exigés par le ministère de l'éducation du ${country} pour cette classe.
`
        }
      }

      // 2. Contexte Pédagogique (Ton et Approche)
      audienceContext = `
IMPORTANT - PRINCIPE DE TRANSMISSION UNIVERSELLE :
Tu dois agir comme un "Traducteur de Complexité".

1. La Hiérarchie Cognitive :
   ${profileType === 'pupil' ? '- Profil Élève : Priorité à l\'analogie concrète, aux exemples du quotidien et à la préparation aux examens officiels.' : '- Profil Étudiant : Rigueur académique, terminologie précise de la filière, mais explications claires.'}

2. Adaptation au Programme :
   Le contenu doit couvrir les points clés du programme officiel identifié via la recherche.

3. Règle de la Métaphore Visuelle : Chaque section doit être illustrée par une image mentale forte.
`
    }

    const prompt = `
Crée un plan de cours détaillé pour le sujet: "${title}"

${searchContext}
${audienceContext}

Le cours doit être structuré comme suit:
- Une description générale du cours (mentionnant qu'il est adapté au programme identifié si applicable)
- 3-5 grandes sections principales (basées sur le programme officiel trouvé)
- Chaque section doit avoir 2-3 sous-parties
- Chaque sous-partie doit avoir:
  * Un titre clair
  * Un contenu explicatif détaillé (2-3 paragraphes)
  * Des mots-clés optimisés pour rechercher une image illustrative sur Wikipedia française
- Chaque section peut avoir une pause de compréhension (check_understanding) si le concept est complexe
- Une conclusion pédagogique

IMPORTANT pour la CONCLUSION:
- NE récite PAS le plan de cours
- Résume les apprentissages clés et ouvre sur une perspective pratique

IMPORTANT pour les mots-clés d'images (imageQuery):
- Utilise des termes simples et précis qui existent sur Wikipedia française
- Privilégie les noms communs

Réponds UNIQUEMENT avec un JSON valide dans ce format:
{
  "title": "titre du cours (adapté au programme)",
  "description": "description générale",
  "sections": [
    {
      "title": "Titre de la section",
      "subsections": [
        {
          "title": "Titre de la sous-partie",
          "content": "Contenu explicatif détaillé...",
          "imageQuery": "mot-clé simple pour Wikipedia"
        }
      ]
    }
  ],
  "conclusion": "Conclusion pédagogique"
}
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

        const parsed = JSON.parse(cleanText)
        console.log('JSON parsé avec succès')
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