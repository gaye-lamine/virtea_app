import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'user_profiles'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      
      // Informations d'onboarding
      table.string('profile_type').notNullable() // Élève, Étudiant, Professionnel, Autre
      table.string('education_level').nullable() // L1, M2, etc.
      table.string('specialty').nullable() // Spécialité / filière
      table.string('name').notNullable()
      table.date('birthdate').nullable()
      
      // Préférences
      table.string('device_id').unique().notNullable() // Pour identifier l'utilisateur
      
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}