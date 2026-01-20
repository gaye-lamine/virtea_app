import vine from '@vinejs/vine'

export const createLessonValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(3).maxLength(200)
  })
)