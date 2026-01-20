import type { HttpContext } from '@adonisjs/core/http'
import UserProfile from '#models/user_profile'

export default class UserProfilesController {
  /**
   * Créer ou mettre à jour un profil utilisateur
   */
  async store({ request, response }: HttpContext) {
    try {
      const data = request.only([
        'profileType',
        'educationLevel',
        'specialty',
        'name',
        'birthdate',
        'deviceId',
      ])

      // Vérifier si un profil existe déjà pour ce device
      const existingProfile = await UserProfile.findBy('device_id', data.deviceId)

      if (existingProfile) {
        // Mettre à jour
        existingProfile.merge(data)
        await existingProfile.save()
        return response.ok({ data: existingProfile })
      }

      // Créer nouveau profil
      const profile = await UserProfile.create(data)
      return response.created({ data: profile })
    } catch (error) {
      console.error('Erreur création profil:', error)
      return response.badRequest({ error: 'Impossible de créer le profil' })
    }
  }

  /**
   * Récupérer un profil par device ID
   */
  async show({ params, response }: HttpContext) {
    try {
      const profile = await UserProfile.findBy('device_id', params.deviceId)

      if (!profile) {
        return response.notFound({ error: 'Profil non trouvé' })
      }

      return response.ok({ data: profile })
    } catch (error) {
      console.error('Erreur récupération profil:', error)
      return response.badRequest({ error: 'Impossible de récupérer le profil' })
    }
  }
}
