import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'user_profiles'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('country').nullable()
      table.string('institution_name').nullable()
      table.string('series').nullable()
      table.string('study_year').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('country')
      table.dropColumn('institution_name')
      table.dropColumn('series')
      table.dropColumn('study_year')
    })
  }
}