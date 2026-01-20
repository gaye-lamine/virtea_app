# Architecture du Professeur Virtuel

## Vue d'ensemble

Le système virtea-Back-v2 est conçu pour créer automatiquement des leçons interactives avec audio streaming, selon le cahier des charges du professeur virtuel.

## Flux de génération d'une leçon

```
1. Élève saisit le titre
   ↓
2. API crée la leçon (statut: processing)
   ↓
3. WebSocket notifie le début (10%)
   ↓
4. IA génère le plan détaillé (30%)
   ↓
5. Récupération images Wikipedia (50%)
   ↓
6. Optimisation images Cloudinary (70%)
   ↓
7. Génération audio TTS (90%)
   ↓
8. Stockage audio Cloudinary (100%)
   ↓
9. Leçon prête (statut: ready)
   ↓
10. WebSocket notifie la fin
```

## Services principaux

### 1. AiService
- **Rôle** : Génération du contenu pédagogique
- **Technologie** : Google Generative AI (Gemini)
- **Sortie** : Plan structuré avec sections/sous-sections

### 2. WikipediaService
- **Rôle** : Récupération d'images éducatives
- **Source** : API Wikipedia française
- **Critères** : Images libres de droits, pertinentes

### 3. CloudinaryService
- **Rôle** : Optimisation et CDN pour médias
- **Fonctions** :
  - Redimensionnement automatique (800x600)
  - Conversion WebP pour les images
  - Stockage audio MP3 optimisé
  - URLs CDN globales

### 4. TTSService
- **Rôle** : Génération audio streaming
- **Technologie** : Google Cloud Text-to-Speech
- **Voix** : fr-FR-Neural2-A (féminine)
- **Stockage** : Cloudinary (pas local)

### 5. WebSocketService
- **Rôle** : Communication temps réel
- **Technologie** : AdonisJS Transmit
- **Événements** :
  - Progression de génération
  - Leçon prête
  - Erreurs

### 6. LessonGeneratorService
- **Rôle** : Orchestration complète
- **Coordonne** : Tous les services ci-dessus
- **Gestion** : Erreurs, rollback, notifications

## Structure des données

### Modèle Lesson
```typescript
{
  id: number
  title: string
  description: string
  plan: JSON // Structure du plan
  content: JSON // Contenu complet avec images/audio
  status: 'draft' | 'processing' | 'ready'
  createdAt: DateTime
  updatedAt: DateTime
}
```

### Structure du contenu généré
```typescript
{
  title: string
  description: string
  sections: [
    {
      title: string
      subsections: [
        {
          title: string
          content: string
          imageQuery: string
          image: {
            url: string (Cloudinary)
            title: string
            description: string
          }
        }
      ]
    }
  ]
  conclusion: string
  audioFiles: {
    intro: string (URL Cloudinary)
    section_0_intro: string
    section_0_subsection_0: string
    conclusion: string
  }
}
```

## Sécurité et performance

### Variables d'environnement requises
- `GOOGLE_GENERATIVE_AI_API_KEY` - Clé API Gemini
- `GOOGLE_CLOUD_PROJECT_ID` - ID projet Google Cloud
- `GOOGLE_CLOUD_KEY_FILE` - Chemin vers la clé JSON TTS
- `CLOUDINARY_CLOUD_NAME` - Nom du cloud Cloudinary
- `CLOUDINARY_API_KEY` - Clé API Cloudinary
- `CLOUDINARY_API_SECRET` - Secret API Cloudinary

### Optimisations
- **Images** : WebP, 800x600, qualité auto
- **Audio** : MP3, qualité auto, streaming
- **Cache** : Headers HTTP appropriés
- **CDN** : Distribution globale via Cloudinary

## Évolutivité

### Prochaines étapes possibles
1. **Cache Redis** pour les leçons populaires
2. **Queue système** pour la génération (Bull/Bee)
3. **Authentification** utilisateurs
4. **Analytics** d'utilisation
5. **API versioning** pour compatibilité
6. **Tests automatisés** complets