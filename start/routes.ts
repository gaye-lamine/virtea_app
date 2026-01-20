/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import AutoSwagger from 'adonis-autoswagger'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import app from '@adonisjs/core/services/app'

router.get('/', async () => {
  return {
    hello: 'world',
  }
})

// Route pour servir le fichier swagger.yaml
router.get('/swagger.json', async () => {
  return readFileSync(join(app.makePath(), 'swagger.yaml'), 'utf-8')
})

// Route pour l'interface Scalar (moderne)
router.get('/docs', async () => {
  return (AutoSwagger as any).default.scalar('/swagger.json')
})

// Route pour l'interface Swagger UI (classique)
router.get('/swagger', async () => {
  return (AutoSwagger as any).default.ui('/swagger.json')
})

import transmit from '@adonisjs/transmit/services/main'

// Routes pour les leçons
router.group(() => {
  router.post('/lessons', '#controllers/lessons_controller.create')
  router.post('/lessons/test', '#controllers/lessons_controller.createTest')
  router.get('/lessons', '#controllers/lessons_controller.index')
  router.get('/lessons/:id', '#controllers/lessons_controller.show')
}).prefix('/api/v1')

// Routes pour l'audio
router.group(() => {
  router.post('/audio/stream', '#controllers/audio_controller.generateStream')
  router.post('/audio/url', '#controllers/audio_controller.getAudioUrl')
}).prefix('/api/v1')

// Routes pour les profils utilisateurs
router.group(() => {
  router.post('/profiles', '#controllers/user_profiles_controller.store')
  router.get('/profiles/:deviceId', '#controllers/user_profiles_controller.show')
}).prefix('/api/v1')

// Routes pour la progression des leçons
router.group(() => {
  router.get('/progress', '#controllers/lesson_progresses_controller.index')
  router.get('/lessons/:lessonId/progress', '#controllers/lesson_progresses_controller.show')
  router.put('/lessons/:lessonId/progress', '#controllers/lesson_progresses_controller.update')
}).prefix('/api/v1')

// Routes pour Q&A
router.group(() => {
  router.post('/qa/generate', '#controllers/qa_controller.generate')
  router.post('/qa/ask', '#controllers/qa_controller.ask')
  router.get('/qa/sessions', '#controllers/qa_controller.sessions')
}).prefix('/api/v1')

// Routes pour Quiz
router.group(() => {
  router.post('/quiz/generate', '#controllers/quiz_controller.generate')
  router.get('/quiz', '#controllers/quiz_controller.index')
}).prefix('/api/v1')

// Route WebSocket pour les mises à jour en temps réel
router.get('/ws', ({ request, response }) => {
  return transmit.subscription(request, response)
})
