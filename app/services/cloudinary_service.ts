import { v2 as cloudinary } from 'cloudinary'
import env from '#start/env'

export interface CloudinaryUploadResult {
  url: string
  publicId: string
  width: number
  height: number
}

export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: env.get('CLOUDINARY_CLOUD_NAME'),
      api_key: env.get('CLOUDINARY_API_KEY'),
      api_secret: env.get('CLOUDINARY_API_SECRET')
    })
  }

  async uploadFromUrl(imageUrl: string, folder: string = 'lessons'): Promise<CloudinaryUploadResult> {
    try {
      const result = await cloudinary.uploader.upload(imageUrl, {
        folder: folder,
        transformation: [
          { width: 800, height: 600, crop: 'fill', quality: 'auto' },
          { format: 'webp' }
        ]
      })

      return {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height
      }
    } catch (error) {
      console.error('Erreur upload Cloudinary:', error)
      throw new Error('Impossible d\'uploader l\'image: ' + error.message)
    }
  }

  async optimizeImages(images: Array<{ url: string, title: string }>): Promise<Array<CloudinaryUploadResult | null>> {
    const promises = images.map(async (image) => {
      try {
        return await this.uploadFromUrl(image.url)
      } catch (error) {
        console.error(`Erreur optimisation image ${image.title}:`, error)
        return null
      }
    })

    return Promise.all(promises)
  }

  async deleteImage(publicId: string): Promise<boolean> {
    try {
      const result = await cloudinary.uploader.destroy(publicId)
      return result.result === 'ok'
    } catch (error) {
      console.error('Erreur suppression image:', error)
      return false
    }
  }
}