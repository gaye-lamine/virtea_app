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
  }[]
  conclusion: string
}

export class AiService {
  private genAI: GoogleGenerativeAI

  constructor() {
    this.genAI = new GoogleGenerativeAI(env.get('GOOGLE_GENERATIVE_AI_API_KEY'))
  }

  getGeminiModel() {
    return this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  }

  async generateLessonPlan(title: string, userProfile?: {
    profileType: string
    educationLevel?: string
    specialty?: string
  }): Promise<LessonPlan> {
    const model = this.getGeminiModel()

    // Adapter le niveau et le style selon le profil
    let audienceContext = ''
    if (userProfile) {
      switch (userProfile.profileType) {
        case 'Élève':
          audienceContext = `
IMPORTANT - ADAPTATION AU PUBLIC:
Ce cours est destiné à un ÉLÈVE (collège/lycée).
- Utilise un vocabulaire simple et accessible
- Explique les concepts de base sans supposer de connaissances préalables
- Utilise des exemples concrets et du quotidien
- Évite le jargon technique complexe
- Rends le contenu engageant et facile à comprendre
${userProfile.educationLevel ? `Niveau: ${userProfile.educationLevel}` : ''}
`
          break
        case 'Étudiant':
          audienceContext = `
IMPORTANT - ADAPTATION AU PUBLIC:
Ce cours est destiné à un ÉTUDIANT universitaire.
- Utilise un vocabulaire académique approprié
- Approfondis les concepts avec rigueur scientifique
- Inclus des références théoriques et des détails techniques
- Suppose des connaissances de base dans le domaine
${userProfile.educationLevel ? `Niveau: ${userProfile.educationLevel}` : ''}
${userProfile.specialty ? `Spécialité: ${userProfile.specialty}` : ''}
`
          break
        case 'Professionnel':
          audienceContext = `
IMPORTANT - ADAPTATION AU PUBLIC:
Ce cours est destiné à un PROFESSIONNEL.
- Focus sur les applications pratiques et concrètes
- Inclus des cas d'usage réels et des exemples professionnels
- Oriente vers l'action et la mise en pratique
- Utilise un ton direct et efficace
${userProfile.specialty ? `Domaine: ${userProfile.specialty}` : ''}
`
          break
        default:
          audienceContext = `
IMPORTANT - ADAPTATION AU PUBLIC:
Ce cours est destiné à un public général.
- Utilise un vocabulaire clair et accessible
- Équilibre entre simplicité et profondeur
- Explique les concepts de manière progressive
`
      }
    }

    const prompt = `
Crée un plan de cours détaillé pour le sujet: "${title}"

${audienceContext}

Le cours doit être structuré comme suit:
- Une description générale du cours
- 3-4 grandes sections principales
- Chaque section doit avoir 2-3 sous-parties
- Chaque sous-partie doit avoir:
  * Un titre clair
  * Un contenu explicatif détaillé (2-3 paragraphes)
  * Des mots-clés optimisés pour rechercher une image illustrative sur Wikipedia française
- Une conclusion

IMPORTANT pour les mots-clés d'images (imageQuery):
- Utilise des termes simples et précis qui existent sur Wikipedia française
- Privilégie les noms communs plutôt que les concepts abstraits
- Évite les termes trop spécifiques ou techniques
- Exemples de bons mots-clés: "atome", "révolution française", "photosynthèse", "système solaire", "ADN", "volcan"
- Évite les mots-clés comme: "concept de", "théorie de", "principe de"

Réponds UNIQUEMENT avec un JSON valide dans ce format:
{
  "title": "titre du cours",
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
  "conclusion": "Conclusion du cours"
}
`

    // Retry avec backoff exponentiel en cas d'erreur 503
    let lastError: any
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`Génération avec Google AI pour: ${title} (tentative ${attempt}/3)`)
        const result = await model.generateContent(prompt)
        const response = await result.response
        const text = response.text()
        
        console.log('Réponse AI reçue:', text.substring(0, 200) + '...')
        
        // Nettoyer la réponse pour extraire le JSON
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
          console.error('Pas de JSON trouvé dans la réponse:', text)
          throw new Error('Format de réponse invalide')
        }
        
        const parsed = JSON.parse(jsonMatch[0])
        console.log('JSON parsé avec succès')
        return parsed
      } catch (error) {
        lastError = error
        console.error(`Erreur génération AI (tentative ${attempt}/3):`, error.message)
        
        // Si c'est une erreur 503 (overloaded) et qu'il reste des tentatives, attendre et réessayer
        if (error.status === 503 && attempt < 3) {
          const waitTime = attempt * 2000 // 2s, 4s
          console.log(`⏳ Attente de ${waitTime}ms avant nouvelle tentative...`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
          continue
        }
        
        // Pour les autres erreurs ou dernière tentative, throw
        break
      }
    }
    
    console.error('Erreur génération AI après 3 tentatives:', lastError)
    throw new Error('Impossible de générer le plan de cours: ' + lastError.message)
  }
}