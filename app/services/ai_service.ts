
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
• Sections (Grandes Parties - titres officiels).
• Sous-sections pour chaque Section (détails des leçons).
• Conclusion de la leçon.

5. RÉDACTION DU CONTENU (CRUCIAL)
• Pour chaque sous-section, tu DOIS rédiger un CONTENU PÉDAGOGIQUE DÉTAILLÉ (champ "content").
• Ce contenu doit être un véritable cours complet, explicatif et structuré, prêt à être lu par l'élève.
• NE JAMAIS METTRE de "contenu en cours de rédaction" ou de phrases vides.

6. FORMAT DE SORTIE (STRICT JSON)
• Réponds EXCLUSIVEMENT avec un objet JSON valide respectant scrupuleusement ce schéma :

\`\`\`json
{
  "title": "Titre officiel de la leçon",
  "description": "Introduction et objectifs de la leçon",
  "sections": [
    {
      "title": "Titre de la Grande Partie 1",
      "subsections": [
        {
          "title": "Titre de la sous-partie 1.1",
          "content": "Texte complet et détaillé du cours pour cette sous-partie. Il doit être riche, explicatif et pédagogique.",
          "imageQuery": "Terme de recherche pour une image illustrative"
        }
      ]
    }
  ],
  "conclusion": "Résumé et ouverture"
}
\`\`\`

• Interdiction formelle : Ne pas inventer de chapitres hors programme.
• Le titre final de la leçon dans le JSON doit être l'intitulé académique officiel trouvé lors de la recherche.
`


    let lastError: any
    const maxAttempts = 5
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`Génération avec Google AI pour: ${title} (tentative ${attempt}/${maxAttempts})`)
        const result = await model.generateContent(prompt)
        const response = await result.response
        const text = response.text()

        console.log('Réponse AI reçue:', text.substring(0, 200) + '...')


        let cleanText = text.trim()


        cleanText = cleanText.replace(/^```[a-zA-Z]*\s*/, '')


        cleanText = cleanText.replace(/```$/, '')


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

            console.warn('JSON non équilibré détecté, tentative avec le reste du texte')
            cleanText = cleanText.substring(firstOpen)
          }
        } else {
          console.error('Pas de JSON valide trouvé dans:', text)
          throw new Error('Format de réponse invalide (pas de JSON détecté)')
        }

        let parsed: any = JSON.parse(cleanText)


        const rootTitle = parsed.titre_lecon || parsed.titre_lecon_officiel || parsed.TitreLeconOfficiel || parsed['Titre de la Leçon'] || parsed.titre || parsed.title || parsed.lesson_title || parsed['Lesson Title']
        const rootDescription = parsed.description || parsed.Introduction || parsed.introduction


        if (!parsed.sections && parsed.plan_de_cours) {
          console.log('⚠️ Structure imbriquée détectée (plan_de_cours), tentative de récupération...')
          parsed = parsed.plan_de_cours
        } else if (!parsed.sections && parsed.course_plan) {
          console.log('⚠️ Structure imbriquée détectée (course_plan), tentative de récupération...')
          parsed = parsed.course_plan
        } else if (!parsed.sections && parsed['Plan de Cours']) {
          console.log('⚠️ Structure imbriquée détectée (Plan de Cours), tentative de récupération...')
          parsed = parsed['Plan de Cours']
        } else if (!parsed.sections && parsed.PlanDeCours) {
          console.log('⚠️ Structure imbriquée détectée (PlanDeCours), tentative de récupération...')
          parsed = parsed.PlanDeCours
        }




        const grandesParties = parsed.grandes_parties || parsed['Grandes Parties'] || parsed.GrandesParties || parsed.sections


        if (!parsed.sections && grandesParties) {
          console.log('⚠️ Structure avec clés françaises/alternatives détectée, tentative de mapping...')
          if (grandesParties.length > 0) {
            console.log('Clés trouvées dans la première partie:', Object.keys(grandesParties[0]))
          }
          parsed.title = rootTitle || parsed.titre_lecon || parsed.titre_lecon_officiel || parsed.TitreLeconOfficiel || parsed['Titre de la Leçon'] || parsed.titre || parsed.title || parsed.lesson_title || parsed['Lesson Title'] || 'Titre de la leçon'
          parsed.description = rootDescription || parsed.description || parsed.Introduction || parsed.introduction || `Leçon sur ${parsed.title}`

          parsed.sections = grandesParties.map((partie: any) => ({
            title: partie.titre || partie.titre_partie || partie.titre_officiel || partie.nom || 'Titre manquant',
            subsections: (partie.sous_parties || partie['Sous-parties'] || partie.SousParties || []).map((sous: any) => ({
              title: sous.titre || sous.titre_sous_partie || sous.nom || 'Sous-titre manquant',
              content: sous.contenu || sous.description || sous.texte || '',
              imageQuery: sous.mots_cles_image || sous.imageQuery || sous.titre || 'image'
            }))
          }))
        }


        if (!parsed.sections || !Array.isArray(parsed.sections)) {
          console.warn('⚠️ JSON invalide reçu (toujours pas de sections):', JSON.stringify(parsed).substring(0, 200) + '...')
          throw new Error('Format de réponse invalide: "sections" manquant ou incorrect')
        }
        parsed.sections.forEach((section: any, index: number) => {

          if (!section.title) {
            section.title = `Section ${index + 1}`
          }

          if (!section.subsections) {
            section.subsections = []
          }

          section.subsections.forEach((subsection: any, subIndex: number) => {

            if (!subsection.title) {
              subsection.title = `Sous-section ${subIndex + 1}`
            }
            if (!subsection.content) {
              subsection.content = `Contenu en cours de rédaction pour ${subsection.title}.`
            }

            if (!subsection.imageQuery || subsection.imageQuery.trim() === '' || subsection.imageQuery === 'undefined') {
              console.warn(`⚠️ imageQuery manquant pour "${subsection.title}", utilisation du titre comme fallback`)

              subsection.imageQuery = subsection.title || section.title || 'education'
            }
          })
        })

        console.log('JSON parsé et validé avec succès')
        return parsed
      } catch (error: any) {
        lastError = error

        const status = error?.status || error?.code || (error?.response && error.response.status) || null
        console.error(`Erreur génération AI (tentative ${attempt}/${maxAttempts}):`, error?.message || error)


        const isTransient = status === 429 || status === 503
        const isJsonError = error instanceof SyntaxError || error.message.includes('JSON') || error.message.includes('Format de réponse invalide')

        if ((isTransient || isJsonError) && attempt < maxAttempts) {

          let waitTime = null
          try {
            const retryAfter = error?.response?.headers?.['retry-after'] || error?.headers?.['retry-after'] || null
            if (retryAfter) {
              const sec = parseInt(retryAfter, 10)
              if (!Number.isNaN(sec)) waitTime = sec * 1000
            }
          } catch (e) {

          }

          if (!waitTime) {

            const base = 1000 * Math.pow(2, attempt - 1)
            const jitter = Math.floor(Math.random() * 1000)
            waitTime = base + jitter
          }

          console.log(`⏳ Attente de ${waitTime}ms avant nouvelle tentative (cause: ${isTransient ? 'API' : 'JSON'})...`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
          continue
        }


        break
      }
    }

    console.error(`Erreur génération AI après ${maxAttempts} tentatives: `, lastError)
    throw new Error('Impossible de générer le plan de cours: ' + (lastError?.message || lastError))
  }
}