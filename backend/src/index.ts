// Import env loader FIRST - this must be before any other imports
import './env'

import { buildApp } from './app'
import { logger } from './infrastructure/logger'

const PORT = parseInt(process.env.PORT || '3001', 10)
const HOST = process.env.HOST || '0.0.0.0'

async function start() {
  try {
    const app = await buildApp()

    await app.listen({ port: PORT, host: HOST })

    logger.info(`Server running on http://${HOST}:${PORT}`)
    logger.info(`Health check: http://${HOST}:${PORT}/health`)
    logger.info(`Metrics: http://${HOST}:${PORT}/metrics`)

    // Graceful shutdown with force exit timeout
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM']
    signals.forEach((signal) => {
      process.on(signal, async () => {
        logger.info(`Received ${signal}, closing server gracefully`)

        // Force exit after 5 seconds if graceful shutdown hangs
        const forceExitTimeout = setTimeout(() => {
          logger.warn('Graceful shutdown timed out, forcing exit')
          process.exit(1)
        }, 5000)
        forceExitTimeout.unref() // Don't keep process alive just for this timer

        try {
          await app.close()
          clearTimeout(forceExitTimeout)
          process.exit(0)
        } catch (err) {
          logger.error(err, 'Error during graceful shutdown')
          process.exit(1)
        }
      })
    })
  } catch (error) {
    logger.error(error, 'Failed to start server')
    process.exit(1)
  }
}

start()
