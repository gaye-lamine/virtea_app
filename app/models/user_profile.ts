import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class UserProfile extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare profileType: string

  @column()
  declare educationLevel: string | null

  @column()
  declare specialty: string | null

  @column()
  declare name: string

  @column.date()
  declare birthdate: DateTime | null

  @column()
  declare deviceId: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
