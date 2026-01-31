import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Lesson extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare title: string
  @column()
  declare deviceId: string

  @column()
  declare description: string

  @column()
  declare plan: string

  @column()
  declare content: string

  @column()
  declare status: 'draft' | 'processing' | 'plan_ready' | 'intro_ready' | 'ready'

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}