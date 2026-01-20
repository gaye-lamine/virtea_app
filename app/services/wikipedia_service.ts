import axios from 'axios'

export interface WikipediaImage {
  url: string
  title: string
  description?: string
}

export class WikipediaService {
  private baseUrl = 'https://fr.wikipedia.org/api/rest_v1'

  async searchImage(query: string): Promise<WikipediaImage | null> {
    try {
      console.log(`🔍 Recherche image Wikipedia pour mot-clé Gemini: "${query}"`)
      
      // Étape 1: Recherche directe avec le mot-clé généré par Gemini
      try {
        const directResponse = await axios.get(`${this.baseUrl}/page/summary/${encodeURIComponent(query)}`, {
          headers: {
            'User-Agent': 'virtea-Back-v2/1.0 (https://virtea.app; contact@virtea.app)'
          },
          timeout: 5000
        })
        
        if (directResponse.data && directResponse.data.thumbnail) {
          const image = {
            url: directResponse.data.thumbnail.source,
            title: directResponse.data.title,
            description: directResponse.data.extract
          }
          console.log(`✅ Image trouvée directement: ${image.title}`)
          return image
        }
      } catch (directError) {
        console.log(`⚠️ Recherche directe échouée pour "${query}":`, directError.message)
      }

      // Étape 2: Recherche via l'API de recherche Wikipedia
      console.log(`🔄 Recherche via API pour: "${query}"`)
      const searchUrl = `https://fr.wikipedia.org/w/api.php`
      const searchParams = {
        action: 'query',
        format: 'json',
        list: 'search',
        srsearch: query,
        srlimit: 5, // Essayer plusieurs résultats
        origin: '*'
      }

      const searchResult = await axios.get(searchUrl, { 
        params: searchParams,
        headers: {
          'User-Agent': 'virtea-Back-v2/1.0 (https://virtea.app; contact@virtea.app)'
        },
        timeout: 5000
      })
      
      if (searchResult.data.query && searchResult.data.query.search.length > 0) {
        // Essayer chaque résultat jusqu'à trouver une image
        for (const result of searchResult.data.query.search) {
          try {
            const pageTitle = result.title
            console.log(`🔍 Essai page: "${pageTitle}"`)
            
            const pageResponse = await axios.get(`${this.baseUrl}/page/summary/${encodeURIComponent(pageTitle)}`, {
              headers: {
                'User-Agent': 'virtea-Back-v2/1.0 (https://virtea.app; contact@virtea.app)'
              },
              timeout: 3000
            })
            
            if (pageResponse.data && pageResponse.data.thumbnail) {
              const image = {
                url: pageResponse.data.thumbnail.source,
                title: pageResponse.data.title,
                description: pageResponse.data.extract
              }
              console.log(`✅ Image trouvée via recherche: ${image.title}`)
              return image
            }
          } catch (pageError) {
            console.log(`⚠️ Erreur page "${result.title}":`, pageError.message)
            continue
          }
        }
      }

      console.log(`❌ Aucune image trouvée pour le mot-clé: "${query}"`)
      return null
    } catch (error) {
      console.error(`❌ Erreur recherche Wikipedia pour "${query}":`, error.message)
      return null
    }
  }



  async getMultipleImages(queries: string[]): Promise<(WikipediaImage | null)[]> {
    const promises = queries.map(query => this.searchImage(query))
    return Promise.all(promises)
  }
}