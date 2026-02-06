import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'user_profiles'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      
      table.string('profile_type').notNullable()
      table.string('education_level').nullable()
      table.string('specialty').nullable()
      table.string('name').notNullable()
      table.date('birthdate').nullable()
      
      table.string('device_id').unique().notNullable()
      
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}