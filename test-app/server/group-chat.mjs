import { createHmac } from 'node:crypto'

const TOKEN_LIFETIME_SECONDS = 60

function respond(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  res.end(JSON.stringify(body))
}

function signToken(payload, secret) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
  const input = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}`
  const signature = createHmac('sha256', secret).update(input).digest('base64url')
  return `${input}.${signature}`
}

/** Local-only Moodle issuer simulation. Fixtures, not request fields, own membership. */
export function groupChatMiddleware({ readEnvironment, readFixtures, now = () => Date.now() }) {
  return (req, res, next) => {
    const path = (req.url || '').split('?')[0]
    if (path !== '/__group-chat/config' && path !== '/__group-chat/token') return next()
    try {
      // Never expose a local signing service to a remote host or cross-origin browser.
      const origin = `http://${req.headers.host}`
      const url = new URL(req.url, origin)
      if (url.hostname !== 'localhost'
          || (req.headers.origin && req.headers.origin !== origin)
          || !['same-origin', 'none', undefined].includes(req.headers['sec-fetch-site'])) {
        return respond(res, 403, { error: 'Local same-origin access is required' })
      }
      if (req.method !== 'GET') return respond(res, 405, { error: 'Use GET' })
      const environment = readEnvironment()
      const secret = environment.ULIBOT_SITE_TOKEN?.trim()
      if (!secret || environment.ULIBOT_SITE_HOST?.trim() !== 'localhost') {
        return respond(res, 503, { error: 'Configure the local site token and localhost host in ulibotlocal/.env' })
      }
      // Reload on renewal so membership changes take effect without restarting Vite.
      const fixtures = readFixtures()
      if (path === '/__group-chat/config') {
        return respond(res, 200, {
          rooms: fixtures.rooms,
          members: fixtures.members.filter(member => member.active)
            .map(({ userid, name, groups }) => ({ userid, name, groups })),
        })
      }
      const member = fixtures.members.find(item => item.userid === url.searchParams.get('userid') && item.active)
      const room = fixtures.rooms.find(item => item.groupid === url.searchParams.get('groupid'))
      if (!member || !room || !member.groups.includes(room.groupid)) {
        return respond(res, 403, { error: 'This local user is not an active member of that group' })
      }
      const issuedAt = Math.floor(now() / 1000)
      const expiresAt = issuedAt + TOKEN_LIFETIME_SECONDS
      const token = signToken({
        iss: 'moodle', host: 'localhost', iat: issuedAt, exp: expiresAt,
        userid: member.userid, name: member.name, group_chat: { version: 1, ...room },
      }, secret)
      return respond(res, 200, { token, expires_at: expiresAt })
    } catch {
      return respond(res, 503, { error: 'Local group configuration could not be loaded' })
    }
  }
}
