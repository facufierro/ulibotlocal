import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn } from 'child_process'
import { mkdirSync, createWriteStream, appendFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import type { IncomingMessage, ServerResponse } from 'http'

function browserConsolePlugin() {
  return {
    name: 'browser-console',
    configureServer(server: { middlewares: { use: (path: string, fn: (req: IncomingMessage, res: ServerResponse) => void) => void } }) {
      const logsDir = resolve(__dirname, 'logs')
      mkdirSync(logsDir, { recursive: true })

      server.middlewares.use('/__console', (req, res) => {
        let body = ''
        req.on('data', (chunk: Buffer) => { body += chunk.toString() })
        req.on('end', () => {
          try {
            const { level, args, timestamp } = JSON.parse(body)
            const date = timestamp.slice(0, 10)
            const logFile = resolve(logsDir, `console-${date}.log`)
            const line = `[${timestamp}] [${level.toUpperCase()}] ${args.join(' ')}\n`
            appendFileSync(logFile, line)
          } catch { /* ignore malformed */ }
          res.writeHead(204)
          res.end()
        })
      })

      console.log('[browser-console] browser console → logs/console-YYYY-MM-DD.log')
    },
    transformIndexHtml() {
      return [
        {
          tag: 'script',
          injectTo: 'head-prepend' as const,
          children: `
            (function() {
              var _levels = ['log','info','warn','error','debug'];
              _levels.forEach(function(level) {
                var orig = console[level].bind(console);
                console[level] = function() {
                  orig.apply(console, arguments);
                  var args = Array.from(arguments).map(function(a) {
                    try {
                      if (a instanceof Error) return a.name + ': ' + a.message + (a.stack ? '\\n' + a.stack : '');
                      return typeof a === 'object' ? JSON.stringify(a) : String(a);
                    } catch(e) { return String(a); }
                  });
                  fetch('/__console', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ level: level, args: args, timestamp: new Date().toISOString() })
                  }).catch(function(){});
                };
              });
            })();
          `,
        },
      ]
    },
  }
}

function dockerLogsPlugin() {
  return {
    name: 'docker-logs',
    configureServer() {
      const logsDir = resolve(__dirname, 'logs')
      mkdirSync(logsDir, { recursive: true })

      const date = new Date().toISOString().slice(0, 10)

      // Truncate all log files for this date on startup
      const logNames = ['backend', 'frontend', 'console']
      logNames.forEach(n => writeFileSync(resolve(logsDir, `${n}-${date}.log`), ''))

      const services: { name: string; cwd: string; service: string }[] = [
        {
          name: 'backend',
          cwd: resolve(__dirname, '../../ulibotback'),
          service: 'ulibotback',
        },
        {
          name: 'frontend',
          cwd: resolve(__dirname, '../../ulibotfront'),
          service: 'ulibotfront',
        },
      ]

      const procs: ReturnType<typeof spawn>[] = []

      for (const { name, cwd, service } of services) {
        const logFile = resolve(logsDir, `${name}-${date}.log`)
        const stream = createWriteStream(logFile, { flags: 'w' })

        const proc = spawn('docker', ['compose', 'logs', '-f', service], { cwd })
        proc.stdout.pipe(stream)
        proc.stderr.pipe(stream)
        procs.push(proc)

        console.log(`[docker-logs] ${service} → logs/${name}-${date}.log`)
      }

      const cleanup = () => procs.forEach(p => p.kill())
      process.once('exit', cleanup)
      process.once('SIGINT', cleanup)
      process.once('SIGTERM', cleanup)
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    browserConsolePlugin(),
    ...(process.env.ULIBOT_EVAL_VIEWER ? [] : [dockerLogsPlugin()]),
  ],
  server: {
    port: 5174, // Use a different port to avoid conflict with the main front
    hmr: false,
  },
})
