const wallEl = document.getElementById('wall')
const sizeSlider = document.getElementById('sizeSlider')
const tileTemplate = document.getElementById('tileTemplate')
const filterForm = document.getElementById('filterForm')
const filterDate = document.getElementById('filterDate')
const filterHex = document.getElementById('filterHex')
const filterName = document.getElementById('filterName')
const filterClear = document.getElementById('filterClear')
const filterMessage = document.getElementById('filterMessage')

const CLIENT_KEY_STORAGE = 'colorWallClientKey'

let allColors = []

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
  const labels = likes.map((like) => (like.name ? like.name : 'Anonymous'))
  return `${likes.length} like · ${labels.join(', ')}`
}

function formatDate(isoDate) {
  return isoDate
}

function setTileSize(px) {
  document.documentElement.style.setProperty('--tile-size', `${px}px`)
}

function hasActiveFilters() {
  return Boolean(filterDate.value || filterHex.value.trim() || filterName.value.trim())
}

function normalizeHexQuery(raw) {
  const query = raw.trim().toUpperCase().replace(/^#/, '')
  if (!query) return ''
  return `#${query}`
}

function colorMatchesName(color, query) {
  return color.likes.some((like) => {
    const label = (like.name || 'Anonymous').toLowerCase()
    return label.includes(query)
  })
}

function getFilteredColors() {
  let colors = allColors
  const date = filterDate.value
  const hexQuery = normalizeHexQuery(filterHex.value)
  const nameQuery = filterName.value.trim().toLowerCase()

  if (date) {
    colors = colors.filter((color) => color.colorDate === date)
  }
  if (hexQuery) {
    colors = colors.filter((color) => color.hex.toUpperCase().includes(hexQuery))
  }
  if (nameQuery) {
    colors = colors.filter((color) => colorMatchesName(color, nameQuery))
  }

  return colors
}

function clearFilterMessage() {
  filterMessage.hidden = true
  filterMessage.textContent = ''
}

function showFilterMessage(text) {
  filterMessage.textContent = text
  filterMessage.hidden = false
}

function updateFilterUi(filteredCount) {
  const active = hasActiveFilters()
  filterClear.hidden = !active
  wallEl.classList.toggle('wall-filtered-single', active && filteredCount === 1)
}

function applyFilters() {
  const filtered = getFilteredColors()
  const active = hasActiveFilters()

  if (active && filtered.length === 0) {
    showFilterMessage('No matching colors.')
  } else {
    clearFilterMessage()
  }

  updateFilterUi(filtered.length)
  renderWall(filtered)
}

function clearFilters() {
  filterDate.value = ''
  filterHex.value = ''
  filterName.value = ''
  clearFilterMessage()
  updateFilterUi(allColors.length)
  renderWall(allColors)
}

async function loadWall() {
  const res = await fetch('/api/wall')
  const data = await res.json()
  allColors = data.colors ?? []

  if (hasActiveFilters()) {
    applyFilters()
    return
  }

  renderWall(allColors)
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

    node.dataset.colorDate = color.colorDate
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
            name_taken: 'This name is already taken for this color.',
            already_liked: 'You already liked this color from this browser.',
            color_not_found: 'Color not found.',
          }
          errorEl.textContent = messages[result.error] || 'Like failed.'
          errorEl.hidden = false
          return
        }

        await loadWall()
      } catch {
        errorEl.textContent = 'Network error.'
        errorEl.hidden = false
      } finally {
        form.querySelector('button').disabled = false
      }
    })

    wallEl.appendChild(node)
  }
}

filterForm.addEventListener('input', applyFilters)
filterForm.addEventListener('change', applyFilters)
filterClear.addEventListener('click', clearFilters)

sizeSlider.addEventListener('input', () => {
  setTileSize(Number(sizeSlider.value))
})

setTileSize(Number(sizeSlider.value))
updateFilterUi(0)
loadWall()
