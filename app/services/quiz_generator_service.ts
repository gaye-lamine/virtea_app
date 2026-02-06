import { AiService } from './ai_service.js'

export interface QuizQuestion {
  id: number
  question: string
  options: string[]
  correctAnswerIndex: number
  explanation: string
  difficulty: number
}

export interface Quiz {
  id: number
  lessonId: number
  title: string
  questions: QuizQuestion[]
  createdAt: Date
}

export class QuizGeneratorService {
  private aiService: AiService

  constructor() {
    this.aiService = new AiService()
  }

  async generateQuiz(
    lessonId: number, 
    title: string, 
    content: any,
    userProfile?: {
      profileType: string
      educationLevel?: string
      specialty?: string
    }
  ): Promise<Quiz> {
    try {
      console.log(`Génération Quiz pour la leçon: ${title}`)
      
      let audienceContext = ''
      if (userProfile) {
        switch (userProfile.profileType) {
          case 'Élève':
            audienceContext = `
ADAPTATION AU PUBLIC - ÉLÈVE:
- Questions simples et directes
- Vocabulaire accessible et clair
- Réponses évidentes pour un niveau scolaire
- Éviter les pièges complexes
${userProfile.educationLevel ? `Niveau: ${userProfile.educationLevel}` : ''}
`
            break
          case 'Étudiant':
            audienceContext = `
ADAPTATION AU PUBLIC - ÉTUDIANT:
- Questions plus approfondies et analytiques
- Vocabulaire académique approprié
- Réflexion critique et analyse
- Nuances et subtilités acceptées
${userProfile.educationLevel ? `Niveau: ${userProfile.educationLevel}` : ''}
${userProfile.specialty ? `Spécialité: ${userProfile.specialty}` : ''}
`
            break
          case 'Professionnel':
            audienceContext = `
ADAPTATION AU PUBLIC - PROFESSIONNEL:
- Questions orientées application pratique
- Cas concrets et situations réelles
- Focus sur l'utilité professionnelle
- Approche pragmatique
${userProfile.specialty ? `Domaine: ${userProfile.specialty}` : ''}
`
            break
          default:
            audienceContext = `
ADAPTATION AU PUBLIC - GÉNÉRAL:
- Questions équilibrées
- Vocabulaire accessible mais précis
- Mélange théorie et pratique
`
        }
      }

      const prompt = `
Génère un quiz complet pour la leçon: "${title}"

${audienceContext}

Contenu de la leçon:
${JSON.stringify(content, null, 2)}

INSTRUCTIONS:
1. Crée exactement 5 questions de type QCM (4 choix chacune)
2. Les questions doivent couvrir différents aspects de la leçon
3. Une seule réponse correcte par question
4. Les mauvaises réponses doivent être plausibles mais clairement incorrectes
5. Chaque question doit avoir une explication détaillée (50-100 mots)
6. Assigne une difficulté de 1 à 5 (1=facile, 5=expert)
7. Varie les types de questions:
   - Questions de définition
   - Questions de compréhension
   - Questions d'application
   - Questions d'analyse

TYPES DE QUESTIONS À INCLURE:
- "Qu'est-ce que..." (définition)
- "Lequel de ces éléments..." (identification)
- "Comment fonctionne..." (mécanisme)
- "Quelle est la principale caractéristique..." (analyse)
- "Dans quel contexte utilise-t-on..." (application)

Réponds UNIQUEMENT avec un JSON valide dans ce format:
{
  "title": "Quiz : [titre de la leçon]",
  "questions": [
    {
      "id": 1,
      "question": "Question claire et précise ?",
      "options": [
        "Réponse correcte",
        "Mauvaise réponse plausible 1",
        "Mauvaise réponse plausible 2", 
        "Mauvaise réponse plausible 3"
      ],
      "correctAnswerIndex": 0,
      "explanation": "Explication détaillée de pourquoi cette réponse est correcte et les autres sont incorrectes.",
      "difficulty": 1-5
    }
  ]
}
`

      const result = await this.aiService.getGeminiModel().generateContent(prompt)
      const response = await result.response
      const text = response.text()
      
      console.log('Réponse AI Quiz reçue:', text.substring(0, 200) + '...')
      
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error('Pas de JSON trouvé dans la réponse Quiz:', text)
        throw new Error('Format de réponse invalide')
      }
      
      const parsed = JSON.parse(jsonMatch[0])
      
      const quiz: Quiz = {
        id: Date.now(),
        lessonId,
        title: parsed.title,
        questions: parsed.questions.map((q: any, index: number) => ({
          id: index + 1,
          question: q.question,
          options: q.options,
          correctAnswerIndex: q.correctAnswerIndex,
          explanation: q.explanation,
          difficulty: q.difficulty || 2
        })),
        createdAt: new Date()
      }
      
      console.log(`Quiz généré avec succès: ${quiz.questions.length} questions`)
      return quiz
      
    } catch (error) {
      console.error('Erreur génération Quiz:', error)
      throw new Error('Impossible de générer le quiz: ' + error.message)
    }
  }
}