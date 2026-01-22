import fs from 'node:fs'
import path from 'node:path'

function safeLog(label, value) {
  console.log(`${label}: ${value}`)
}

function inspectJson(json) {
  if (!json) return safeLog('present', false)
  safeLog('type', json.type || 'n/a')
  safeLog('client_email', json.client_email ? json.client_email.replace(/(.+)@(.+)/, '$1@...') : 'n/a')
  const pk = json.private_key
  if (!pk) return safeLog('private_key', 'missing')
  safeLog('private_key_has_begin', pk.includes('BEGIN PRIVATE KEY'))
  safeLog('private_key_has_end', pk.includes('END PRIVATE KEY'))
  safeLog('private_key_has_newlines', pk.includes('\n'))
  safeLog('private_key_length', pk.length)
}

try {
  console.log('=== Inspecting environment variables ===')

  const rawEnvJson = process.env.GOOGLE_CLOUD_CREDENTIALS
  if (rawEnvJson) {
    console.log('\nFound GOOGLE_CLOUD_CREDENTIALS in environment (inline JSON)')
    try {
      const parsed = JSON.parse(rawEnvJson)
      inspectJson(parsed)
    } catch (err) {
      console.error('Failed to JSON.parse(GOOGLE_CLOUD_CREDENTIALS):', err.message)
    }
  } else {
    console.log('\nGOOGLE_CLOUD_CREDENTIALS not set in environment')
  }

  const keyFileEnv = process.env.GOOGLE_CLOUD_KEY_FILE
  const appCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS

  console.log('\nChecking for key file variables:')
  safeLog('GOOGLE_CLOUD_KEY_FILE', keyFileEnv || '(not set)')
  safeLog('GOOGLE_APPLICATION_CREDENTIALS', appCreds || '(not set)')

  const candidate = keyFileEnv || appCreds
  if (candidate) {
    let p = candidate
    if (!path.isAbsolute(p)) p = path.resolve(process.cwd(), p)
    console.log('\nInspecting file:', p)
    if (fs.existsSync(p)) {
      const contents = fs.readFileSync(p, 'utf8')
      try {
        const parsed = JSON.parse(contents)
        inspectJson(parsed)
      } catch (err) {
        console.error('Failed to JSON.parse file content:', err.message)
      }
    } else {
      console.error('File does not exist at path:', p)
    }
  } else {
    console.log('\nNo key file environment variable set (GOOGLE_CLOUD_KEY_FILE or GOOGLE_APPLICATION_CREDENTIALS)')
  }

  console.log('\n=== Diagnostic complete ===')
  console.log('\nRecommendations:')
  console.log('- Prefer to set GOOGLE_APPLICATION_CREDENTIALS=/full/path/to/sa.json (sa.json is the Google service account JSON file).')
  console.log("- Avoid embedding the full JSON into a single .env line unless you ensure proper escaping of newlines (\\n) and quoting.")
  console.log('- If you must embed the JSON, ensure it is valid JSON and that your process actually receives it (no accidental trimming by the platform).')
} catch (err) {
  console.error('Unexpected error in diagnostic script:', err.message)
}
