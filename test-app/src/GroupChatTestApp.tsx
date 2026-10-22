import { useEffect, useState } from 'react'
import { LOCAL_BACKEND_URL } from './localConfig'
import './group-chat.css'

interface LocalMember {
  userid: string
  name: string
  groups: string[]
}

interface LocalRoom {
  groupid: string
  groupname: string
  courseid: string
  coursename: string
  context: string
  contextinstance: string
}

interface LocalGroups {
  members: LocalMember[]
  rooms: LocalRoom[]
}

export default function GroupChatTestApp() {
  const [configuration, setConfiguration] = useState<LocalGroups | null>(null)
  const [error, setError] = useState('')
  const query = new URLSearchParams(window.location.search)
  const member = configuration?.members.find(item => item.userid === query.get('userid'))
  const room = configuration?.rooms.find(item => item.groupid === query.get('groupid'))
  const allowedRooms = configuration?.rooms.filter(item => member?.groups.includes(item.groupid)) ?? []

  useEffect(() => {
    const controller = new AbortController()
    void fetch('/__group-chat/config', { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error((await response.json()).error)
        return response.json() as Promise<LocalGroups>
      })
      .then(setConfiguration)
      .catch(reason => { if (!controller.signal.aborted) setError(reason.message) })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!member || !room) return
    const controller = new AbortController()
    const groupTokenUrl = `/__group-chat/token?${new URLSearchParams({ userid: member.userid, groupid: room.groupid })}`
    let script: HTMLScriptElement | undefined
    void fetch(groupTokenUrl, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error((await response.json()).error)
        return response.json() as Promise<{ token: string }>
      })
      .then(({ token }) => {
        if (controller.signal.aborted) return
        script = document.createElement('script')
        script.src = 'http://localhost:3000/widget.js'
        script.onload = () => {
          if (controller.signal.aborted) return
          void Promise.resolve(window.insertUliBotWidget({
            url: 'http://localhost:3000', backurl: LOCAL_BACKEND_URL,
            token, userid: member.userid, name: member.name,
            courseid: room.courseid, coursename: room.coursename,
            context: room.context, contextinstance: room.contextinstance,
            chatMode: 'group', groupTokenUrl,
          })).then(() => {
            if (!controller.signal.aborted && !document.querySelector('#ulibot-group-container #ulibot-host')) {
              setError('The group widget could not be mounted. Check the backend, frontend, and seeded group context.')
            }
          }).catch(() => setError('The group widget could not be mounted. Check the local backend and frontend.'))
        }
        script.onerror = () => setError('Widget assets could not be loaded from localhost:3000.')
        document.body.appendChild(script)
      })
      .catch(reason => { if (!controller.signal.aborted) setError(reason.message) })
    return () => {
      controller.abort()
      script?.remove()
    }
  }, [member, room])

  const select = (userid: string, groupid = '') => {
    const parameters = new URLSearchParams({ userid })
    if (groupid) parameters.set('groupid', groupid)
    window.location.assign(`/groups?${parameters}`)
  }

  return <main className="local-group-test">
    <h1>Group chat test</h1>
    <p>Local membership simulation — not Moodle login. Replies use the real configured assistant.</p>
    <p>Open this page in two tabs, select Ana and Luis in group A, then send messages or ask @Uli.</p>
    <p><a href="/">Personal chat tests</a> · <a href="/evaluations">Evaluation results</a></p>
    {error && <p role="alert">{error}</p>}
    {!configuration && !error && <p role="status">Loading local groups…</p>}
    {configuration && <div className="local-group-test__controls">
      <label>User <select value={member?.userid ?? ''} onChange={event => select(event.target.value)}>
        <option value="">Select a user</option>
        {configuration.members.map(item => <option key={item.userid} value={item.userid}>{item.name}</option>)}
      </select></label>
      <label>Group <select value={room?.groupid ?? ''} disabled={!member}
        onChange={event => select(member!.userid, event.target.value)}>
        <option value="">Select a group</option>
        {allowedRooms.map(item => <option key={item.groupid} value={item.groupid}>{item.groupname}</option>)}
      </select></label>
      {member && room && <p>Speaking as {member.name} in {room.groupname}.</p>}
    </div>}
    <div id="ulibot-group-container" />
  </main>
}
