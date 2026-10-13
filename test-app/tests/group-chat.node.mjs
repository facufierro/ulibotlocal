import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { groupChatMiddleware } from '../server/group-chat.mjs'

const fixtures = JSON.parse(readFileSync(new URL('../server/group-chat-fixtures.json', import.meta.url), 'utf8'))
const environment = { ULIBOT_SITE_HOST: 'localhost', ULIBOT_SITE_TOKEN: 'test-only-secret' }

function harness(options = {}) {
  const current = structuredClone(fixtures)
  const middleware = groupChatMiddleware({
    readEnvironment: () => environment, readFixtures: () => current, now: () => 2000000000000, ...options,
  })
  function request(url, headers = {}, method = 'GET') {
    const result = { next: false }
    middleware({ url, method, headers: { host: 'localhost:5174', 'sec-fetch-site': 'same-origin', ...headers } }, {
      writeHead(status, responseHeaders) { result.status = status; result.headers = responseHeaders },
      end(body) { result.body = JSON.parse(body) },
    }, () => { result.next = true })
    return result
  }
  return { current, request }
}

test('signs verified fixture identity and room scope using the existing local secret', () => {
  const { request } = harness()
  const response = request('/__group-chat/token?userid=9101&groupid=9201&name=Impostor')
  assert.equal(response.status, 200)
  assert.equal(response.headers['Cache-Control'], 'no-store')
  const [header, payload, signature] = response.body.token.split('.')
  assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url')), { alg: 'HS256', typ: 'JWT' })
  assert.equal(signature, createHmac('sha256', environment.ULIBOT_SITE_TOKEN).update(`${header}.${payload}`).digest('base64url'))
  const claims = JSON.parse(Buffer.from(payload, 'base64url'))
  assert.equal(claims.iss, 'moodle')
  assert.equal(claims.host, 'localhost')
  assert.equal(claims.userid, '9101')
  assert.equal(claims.name, 'Ana')
  assert.equal(claims.exp - claims.iat, 60)
  assert.equal(response.body.expires_at, claims.exp)
  assert.deepEqual(claims.group_chat, { version: 1, ...fixtures.rooms[0] })
})

test('rejects another group, missing claims, and unknown identities', () => {
  const { request } = harness()
  for (const query of ['userid=9101&groupid=9202', 'userid=unknown&groupid=9201', 'userid=9101', 'groupid=9201']) {
    assert.equal(request(`/__group-chat/token?${query}`).status, 403)
  }
})

test('renewal rereads membership and rejects a removed or inactive member', () => {
  const { current, request } = harness()
  const url = '/__group-chat/token?userid=9101&groupid=9201'
  assert.equal(request(url).status, 200)
  current.members[0].groups = []
  assert.equal(request(url).status, 403)
  current.members[0].groups = ['9201']
  current.members[0].active = false
  assert.equal(request(url).status, 403)
  assert.ok(!request('/__group-chat/config').body.members.some(member => member.userid === '9101'))
})

test('configuration exposes choices but never the signing secret or tokens', () => {
  const response = harness().request('/__group-chat/config')
  assert.equal(response.status, 200)
  assert.equal(response.body.members.length, 3)
  assert.ok(!JSON.stringify(response.body).includes(environment.ULIBOT_SITE_TOKEN))
  assert.ok(!Object.hasOwn(response.body, 'token'))
})

test('rejects remote host headers and cross-origin requests', () => {
  const { request } = harness()
  for (const headers of [{ host: 'remote.example:5174' }, { host: '127.0.0.1:5174' },
    { origin: 'http://remote.example' }, { 'sec-fetch-site': 'cross-site' }, { 'sec-fetch-site': 'same-site' }]) {
    assert.equal(request('/__group-chat/config', headers).status, 403)
  }
  assert.equal(request('/__group-chat/config', { origin: 'http://localhost:5174' }).status, 200)
})

test('fails explicitly on missing or non-local configuration without leaking secrets', () => {
  for (const values of [{ ULIBOT_SITE_HOST: 'localhost' }, { ...environment, ULIBOT_SITE_HOST: 'production.example' }]) {
    const response = harness({ readEnvironment: () => values }).request('/__group-chat/config')
    assert.equal(response.status, 503)
    assert.ok(!JSON.stringify(response.body).includes(environment.ULIBOT_SITE_TOKEN))
  }
  const response = harness({ readFixtures: () => { throw new Error(environment.ULIBOT_SITE_TOKEN) } }).request('/__group-chat/config')
  assert.equal(response.status, 503)
  assert.ok(!JSON.stringify(response.body).includes(environment.ULIBOT_SITE_TOKEN))
})

test('only owns its exact routes and accepts GET only', () => {
  const { request } = harness()
  assert.equal(request('/evaluations').next, true)
  assert.equal(request('/__group-chat/token-extra').next, true)
  assert.equal(request('/__group-chat/config', {}, 'POST').status, 405)
})
