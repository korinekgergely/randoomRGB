const wallEl = document.getElementById('wall')
const sizeSlider = document.getElementById('sizeSlider')
const tileTemplate = document.getElementById('tileTemplate')

const CLIENT_KEY_STORAGE = 'colorWallClientKey'

function getClientKey() {
  let key = localStorage.getItem(CLIENT_KEY_STORAGE)
  if (!key) {
    key = crypto.randomUUID()
    localStorage.setItem(CLIENT_KEY_STORAGE, key)
  }
  return key
}

function formatLikes(likes) {
  if (!likes.length) return '0 like'
  const labels = likes.map((like) => (like.name ? like.name : 'Anonim'))
  return `${likes.length} like · ${labels.join(', ')}`
}

function formatDate(isoDate) {
  const [y, m, d] = isoDate.split('-')
  return `${y}.${m}.${d}.`
}

function setTileSize(px) {
  document.documentElement.style.setProperty('--tile-size', `${px}px`)
}

async function loadWall() {
  const res = await fetch('/api/wall')
  const data = await res.json()
  renderWall(data.colors ?? [])
}

function renderWall(colors) {
  wallEl.replaceChildren()

  for (const color of colors) {
    const node = tileTemplate.content.firstElementChild.cloneNode(true)
    const swatch = node.querySelector('.swatch')
    const hexEl = node.querySelector('.hex')
    const dateEl = node.querySelector('.date')
    const likesEl = node.querySelector('.likes')
    const form = node.querySelector('.like-form')
    const errorEl = node.querySelector('.like-error')
    const nameInput = form.querySelector('input[name="name"]')

    swatch.style.backgroundColor = color.hex
    hexEl.textContent = color.hex
    dateEl.textContent = formatDate(color.colorDate)
    likesEl.textContent = formatLikes(color.likes)

    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      errorEl.hidden = true
      form.querySelector('button').disabled = true

      try {
        const response = await fetch('/api/like', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            colorId: color.id,
            clientKey: getClientKey(),
            name: nameInput.value.trim() || null,
          }),
        })

        const result = await response.json()
        if (!response.ok || !result.ok) {
          const messages = {
            name_taken: 'Ez a név már szerepel ennél a színnél.',
            already_liked: 'Ebből a böngészőből már like-oltad ezt a színt.',
            color_not_found: 'A szín nem található.',
          }
          errorEl.textContent = messages[result.error] || 'Like sikertelen.'
          errorEl.hidden = false
          return
        }

        await loadWall()
      } catch {
        errorEl.textContent = 'Hálózati hiba.'
        errorEl.hidden = false
      } finally {
        form.querySelector('button').disabled = false
      }
    })

    wallEl.appendChild(node)
  }
}

sizeSlider.addEventListener('input', () => {
  setTileSize(Number(sizeSlider.value))
})

setTileSize(Number(sizeSlider.value))
loadWall()
