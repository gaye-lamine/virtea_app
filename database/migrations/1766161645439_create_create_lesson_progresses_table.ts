import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'lesson_progress'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      
      table.integer('lesson_id').unsigned().references('id').inTable('lessons').onDelete('CASCADE')
      table.string('device_id').notNullable()
      
      table.integer('current_section_index').defaultTo(0)
      table.integer('current_subsection_index').defaultTo(0)
      table.json('completed_sections').nullable()
      table.boolean('is_completed').defaultTo(false)
      
      table.timestamp('last_reviewed_at').nullable()
      table.timestamp('next_review_at').nullable()
      table.integer('review_count').defaultTo(0)
      
      table.timestamp('created_at')
      table.timestamp('updated_at')
      
      table.index(['lesson_id', 'device_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}