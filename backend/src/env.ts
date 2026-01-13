// Load .env file - this must be imported before any other modules that use environment variables
import { readFileSync } from 'fs'
import { join } from 'path'

try {
  const envPath = join(process.cwd(), '.env')
  const envFile = readFileSync(envPath, 'utf-8')
  envFile.split('\n').forEach((line) => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=')
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '')
        process.env[key.trim()] = value.trim()
      }
    }
  })
  console.log('Loaded .env file successfully')
} catch (error) {
  // .env file doesn't exist, will use environment variables from shell
  console.log('No .env file found, using environment variables from shell')
}
