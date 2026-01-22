import fs from 'node:fs'
import path from 'node:path'

/**
 * Write Google service account credentials to a file when provided via env.
 * Supports two env formats:
 * - GOOGLE_CLOUD_CREDENTIALS_BASE64 : base64 encoded JSON
 * - GOOGLE_CLOUD_CREDENTIALS : inline JSON (less recommended)
 */
try {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const base64 = process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64
    const inline = process.env.GOOGLE_CLOUD_CREDENTIALS

    let jsonStr: string | null = null

    if (base64) {
      try {
        jsonStr = Buffer.from(base64, 'base64').toString('utf8')
      } catch (err) {
        console.error('Failed to decode GOOGLE_CLOUD_CREDENTIALS_BASE64:', err.message)
      }
    } else if (inline) {
      // Try to detect if inline is base64 or JSON
      const maybe = inline.trim()
      // Heuristic: base64 strings are long and contain only base64 chars and padding
      const base64Regex = /^[A-Za-z0-9+/=\r\n]+$/
      if (maybe.length > 200 && base64Regex.test(maybe)) {
        try {
          jsonStr = Buffer.from(maybe, 'base64').toString('utf8')
        } catch (err) {
          // fallback to using inline directly
          jsonStr = inline
        }
      } else {
        // Inline JSON sometimes contains unescaped newlines; try to parse directly
        jsonStr = inline
      }
    }

    if (jsonStr) {
      try {
        const parsed = JSON.parse(jsonStr)
        const out = path.resolve(process.cwd(), 'config/keys/virtea-tts-key.json')
        fs.mkdirSync(path.dirname(out), { recursive: true })
        fs.writeFileSync(out, JSON.stringify(parsed, null, 2), { mode: 0o600 })
        process.env.GOOGLE_APPLICATION_CREDENTIALS = out
        console.log('Google credentials file written to', out)
      } catch (err) {
        console.error('Failed to parse/write Google credentials JSON:', err.message)
      }
    }
  }
} catch (err) {
  console.error('Unexpected error in load_gcloud_creds:', err.message)
}
