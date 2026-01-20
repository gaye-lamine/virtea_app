import vine from '@vinejs/vine'

export const generateAudioValidator = vine.compile(
  vine.object({
    text: vine.string().trim().minLength(1).maxLength(5000),
    voice: vine.string().optional()
  })
)