import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn } from 'child_process'
import { mkdirSync, createWriteStream } from 'fs'
import { resolve } from 'path'

function dockerLogsPlugin() {
  return {
    name: 'docker-logs',
    configureServer() {
      const logsDir = resolve(__dirname, 'logs')
      mkdirSync(logsDir, { recursive: true })

      const date = new Date().toISOString().slice(0, 10)
      const logFile = resolve(logsDir, `backend-${date}.log`)
      const stream = createWriteStream(logFile, { flags: 'a' })

      const backendDir = resolve(__dirname, '../../ulibotback')
      const proc = spawn('docker', ['compose', 'logs', '-f', 'ulibotback'], {
        cwd: backendDir,
      })

      proc.stdout.pipe(stream)
      proc.stderr.pipe(stream)

      console.log(`[docker-logs] streaming container logs → logs/backend-${date}.log`)
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), dockerLogsPlugin()],
  server: {
    port: 5174, // Use a different port to avoid conflict with the main front
    hmr: false,
  },
})
