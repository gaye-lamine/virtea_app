import env from '#start/env'
import { defineConfig } from '@adonisjs/lucid'

const dbConfig = defineConfig({
  connection: 'pg', 
  connections: {
    pg: {
      client: 'pg', 
      connection: env.get('DATABASE_URL'), 
      debug: env.get('NODE_ENV') !== 'production',
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
    },
  },
})

export default dbConfig
