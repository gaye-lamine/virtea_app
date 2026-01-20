import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Lesson from './lesson.js'

export default class LessonProgress extends BaseModel {
  static table = 'lesson_progress'
  
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare lessonId: number

  @column()
  declare deviceId: string

  @column()
  declare currentSectionIndex: number

  @column()
  declare currentSubsectionIndex: number

  @column({
    prepare: (value: any) => value ? JSON.stringify(value) : null,
    consume: (value: string | null) => {
      if (!value) return []
      try {
        return JSON.parse(value)
      } catch {
        return []
      }
    },
  })
  declare completedSections: number[] | null

  @column()
  declare isCompleted: boolean

  @column.dateTime()
  declare lastReviewedAt: DateTime | null

  @column.dateTime()
  declare nextReviewAt: DateTime | null

  @column()
  declare reviewCount: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Lesson)
  declare lesson: BelongsTo<typeof Lesson>
}
