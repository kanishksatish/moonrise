const status = document.querySelector('#status')
const key = document.querySelector('#key')
const save = document.querySelector('#save')
const disconnect = document.querySelector('#disconnect')
async function call(route, body = {}) {
  const response = await fetch(`/__moonrise/ai/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Moonrise-Client': '1' }, body: JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(5000) })
  if (!response.ok) throw new Error('Could not update the connection. Check the key format and that the local server is running.')
  return response.json()
}
function show(configured) {
  disconnect.hidden = !configured
  status.textContent = configured ? 'Key configured for this session. Open Moonrise, then Settings to generate and review prompts. API access is checked only when you generate.' : 'No OpenAI key is connected. Built-in prompts remain available.'
}
call('status').then(data => show(data.configured)).catch(() => { status.textContent = 'The local server could not be reached.' })
document.querySelector('#connect').addEventListener('submit', async event => {
  event.preventDefault(); save.disabled = true
  let value = key.value.trim(); key.value = ''
  try { show((await call('setup', { apiKey: value })).configured) }
  catch (error) { status.textContent = error.message }
  finally { value = ''; save.disabled = false }
})
disconnect.addEventListener('click', async () => {
  disconnect.disabled = true
  try { show((await call('disconnect')).configured) }
  catch (error) { status.textContent = error.message }
  finally { disconnect.disabled = false }
})
