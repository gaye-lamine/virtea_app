import { AiService } from './ai_service.js'

export interface QAItem {
  id: number
  question: string
  answer: string
  category: string
  relatedTopics: string[]
  difficulty: number
}

export interface QASession {
  id: number
  lessonId: number
  title: string
  items: QAItem[]
  createdAt: Date
}

export class QAGeneratorService {
  private aiService: AiService

  constructor() {
    this.aiService = new AiService()
  }

  async generateQASession(
    lessonId: number,
    title: string,
    content: any,
    userProfile?: {
      profileType: string
      educationLevel?: string
      specialty?: string
    }
  ): Promise<QASession> {
    try {
      console.log(`Génération Q&A pour la leçon: ${title}`)

      // Adapter le niveau selon le profil
      let audienceContext = ''
      if (userProfile) {
        switch (userProfile.profileType) {
          case 'Élève':
            audienceContext = `
ADAPTATION AU PUBLIC - ÉLÈVE:
- Questions simples et accessibles
- Réponses claires avec vocabulaire adapté
- Exemples concrets du quotidien
- Éviter le jargon technique
${userProfile.educationLevel ? `Niveau: ${userProfile.educationLevel}` : ''}
`
            break
          case 'Étudiant':
            audienceContext = `
ADAPTATION AU PUBLIC - ÉTUDIANT:
- Questions approfondies et académiques
- Réponses détaillées avec rigueur scientifique
- Références théoriques appropriées
- Vocabulaire technique précis
${userProfile.educationLevel ? `Niveau: ${userProfile.educationLevel}` : ''}
${userProfile.specialty ? `Spécialité: ${userProfile.specialty}` : ''}
`
            break
          case 'Professionnel':
            audienceContext = `
ADAPTATION AU PUBLIC - PROFESSIONNEL:
- Questions orientées application pratique
- Réponses axées sur l'utilisation concrète
- Cas d'usage professionnels
- Approche pragmatique
${userProfile.specialty ? `Domaine: ${userProfile.specialty}` : ''}
`
            break
          default:
            audienceContext = `
ADAPTATION AU PUBLIC - GÉNÉRAL:
- Questions équilibrées entre simplicité et profondeur
- Réponses accessibles mais complètes
- Exemples variés
`
        }
      }

      const prompt = `
Génère une session de Questions & Réponses complète pour la leçon: "${title}"

${audienceContext}

Contenu de la leçon:
${JSON.stringify(content, null, 2)}

INSTRUCTIONS:
1. Crée exactement 8 questions variées et pertinentes
2. Chaque question doit avoir une catégorie parmi: "definition", "explanation", "example", "application", "comparison", "history", "general"
3. Les réponses doivent être détaillées (100-200 mots) et pédagogiques
4. Assigne une difficulté de 1 à 5 (1=facile, 5=expert)
5. Ajoute 2-3 sujets liés pour chaque Q&A
6. Varie les types de questions pour couvrir tous les aspects de la leçon

TYPES DE QUESTIONS À INCLURE:
- Questions de définition ("Qu'est-ce que...?")
- Questions d'explication ("Comment fonctionne...?")
- Questions d'exemple ("Peux-tu donner un exemple de...?")
- Questions d'application ("Comment utiliser...?")
- Questions de comparaison ("Quelle est la différence entre...?")
- Questions générales sur l'importance/utilité

Réponds UNIQUEMENT avec un JSON valide dans ce format:
{
  "title": "Q&A : [titre de la leçon]",
  "items": [
    {
      "id": 1,
      "question": "Question claire et précise",
      "answer": "Réponse détaillée et pédagogique de 100-200 mots",
      "category": "definition|explanation|example|application|comparison|history|general",
      "relatedTopics": ["sujet1", "sujet2", "sujet3"],
      "difficulty": 1-5
    }
  ]
}
`

      const result = await this.aiService.getGeminiModel().generateContent(prompt)
      const response = await result.response
      const text = response.text()

      console.log('Réponse AI Q&A reçue:', text.substring(0, 200) + '...')

      // Nettoyer la réponse pour extraire le JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error('Pas de JSON trouvé dans la réponse Q&A:', text)
        throw new Error('Format de réponse invalide')
      }

      const parsed = JSON.parse(jsonMatch[0])

      const qaSession: QASession = {
        id: Date.now(),
        lessonId,
        title: parsed.title,
        items: parsed.items.map((item: any, index: number) => ({
          id: index + 1,
          question: item.question,
          answer: item.answer,
          category: item.category,
          relatedTopics: item.relatedTopics || [],
          difficulty: item.difficulty || 2
        })),
        createdAt: new Date()
      }

      console.log(`Q&A générée avec succès: ${qaSession.items.length} questions`)
      return qaSession

    } catch (error) {
      console.error('Erreur génération Q&A:', error)
      throw new Error('Impossible de générer la session Q&A: ' + error.message)
    }
  }

  async answerCustomQuestion(
    _lessonId: number,
    question: string,
    lessonContent: any,
    userProfile?: {
      profileType: string
      educationLevel?: string
      specialty?: string
    }
  ): Promise<string> {
    try {
      console.log(`Réponse à la question: ${question}`)

      // Adapter le niveau selon le profil
      let audienceContext = ''
      if (userProfile) {
        switch (userProfile.profileType) {
          case 'Élève':
            audienceContext = 'Réponds de manière simple et accessible, avec des exemples concrets.'
            break
          case 'Étudiant':
            audienceContext = 'Réponds de manière académique et détaillée, avec rigueur scientifique.'
            break
          case 'Professionnel':
            audienceContext = 'Réponds de manière pratique, orientée application professionnelle.'
            break
          default:
            audienceContext = 'Réponds de manière équilibrée, accessible mais complète.'
        }
      }

      const prompt = `
Tu es un professeur expert. Un utilisateur te pose cette question sur la leçon:

QUESTION: "${question}"

CONTEXTE DE LA LEÇON:
${JSON.stringify(lessonContent, null, 2)}

INSTRUCTIONS:
${audienceContext}
- Réponds en 100-250 mots maximum
- Base ta réponse sur le contenu de la leçon fourni
- Sois pédagogique et précis
- Si la question sort du contexte de la leçon, redirige vers le contenu pertinent
- Utilise un ton bienveillant et encourageant

Réponds directement sans formatage JSON, juste le texte de la réponse.
`

      const result = await this.aiService.getGeminiModel().generateContent(prompt)
      const response = await result.response
      const answer = response.text().trim()

      console.log('Réponse personnalisée générée:', answer.substring(0, 100) + '...')
      return answer

    } catch (error) {
      console.error('Erreur réponse personnalisée:', error)
      return 'Je ne peux pas répondre à cette question pour le moment. Veuillez consulter le contenu de la leçon ou reformuler votre question.'
    }
  }
}