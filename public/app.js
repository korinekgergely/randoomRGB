const wallEl = document.getElementById('wall')
const sizeSlider = document.getElementById('sizeSlider')
const tileTemplate = document.getElementById('tileTemplate')
const filterForm = document.getElementById('filterForm')
const filterDate = document.getElementById('filterDate')
const filterHex = document.getElementById('filterHex')
const filterName = document.getElementById('filterName')
const filterClear = document.getElementById('filterClear')
const filterMessage = document.getElementById('filterMessage')
const infoToggle = document.getElementById('infoToggle')
const infoPanel = document.getElementById('infoPanel')
const infoClose = document.getElementById('infoClose')

const CLIENT_KEY_STORAGE = 'colorWallClientKey'
const MESSAGE_HIDE_MS = 30000

let allColors = []
const messageTimers = new WeakMap()

function hideMessage(el) {
  const timer = messageTimers.get(el)
  if (timer) {
    window.clearTimeout(timer)
    messageTimers.delete(el)
  }
  el.hidden = true
  el.textContent = ''
}

function showTemporaryMessage(el, text) {
  hideMessage(el)
  el.textContent = text
  el.hidden = false
  const timer = window.setTimeout(() => hideMessage(el), MESSAGE_HIDE_MS)
  messageTimers.set(el, timer)
}

function getClientKey() {
  let key = localStorage.getItem(CLIENT_KEY_STORAGE)
  if (!key) {
    key = crypto.randomUUID()
    localStorage.setItem(CLIENT_KEY_STORAGE, key)
  }
  return key
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function highlightSubstring(text, query) {
  if (!query) return escapeHtml(text)

  const parts = []
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  let start = 0
  let index = lower.indexOf(q, start)

  while (index !== -1) {
    if (index > start) parts.push(escapeHtml(text.slice(start, index)))
    parts.push(
      `<mark class="like-highlight">${escapeHtml(text.slice(index, index + q.length))}</mark>`,
    )
    start = index + q.length
    index = lower.indexOf(q, start)
  }

  if (start < text.length) parts.push(escapeHtml(text.slice(start)))
  return parts.join('')
}

function renderHexHtml(hex, hexQuery) {
  const normalized = hex.toUpperCase()
  if (!hexQuery) return escapeHtml(normalized)
  return highlightSubstring(normalized, hexQuery)
}

function renderLikesHtml(likes, nameQuery) {
  if (!likes.length) return '0 like'

  const labels = likes.map((like) => {
    const label = like.name || 'Anonymous'
    return nameQuery ? highlightSubstring(label, nameQuery) : escapeHtml(label)
  })

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

function getHexQuery() {
  return filterHex.value.trim().toUpperCase().replace(/^#/, '')
}

function colorMatchesHex(color, query) {
  const hex = color.hex.toUpperCase().replace(/^#/, '')
  return hex.includes(query)
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
  const hexQuery = getHexQuery()
  const nameQuery = filterName.value.trim().toLowerCase()

  if (date) {
    colors = colors.filter((color) => color.colorDate === date)
  }
  if (hexQuery) {
    colors = colors.filter((color) => colorMatchesHex(color, hexQuery))
  }
  if (nameQuery) {
    colors = colors.filter((color) => colorMatchesName(color, nameQuery))
  }

  return colors
}

function clearFilterMessage() {
  hideMessage(filterMessage)
}

function showFilterMessage(text) {
  showTemporaryMessage(filterMessage, text)
}

function updateFilterUi() {
  filterClear.hidden = !hasActiveFilters()
}

function applyFilters() {
  const filtered = getFilteredColors()
  const active = hasActiveFilters()

  if (active && filtered.length === 0) {
    showFilterMessage('No matching colors.')
  } else {
    clearFilterMessage()
  }

  updateFilterUi()
  renderWall(filtered)
}

function clearFilters() {
  filterDate.value = ''
  filterHex.value = ''
  filterName.value = ''
  clearFilterMessage()
  updateFilterUi()
  renderWall(allColors)
}

function updateDateFilterBounds() {
  if (!allColors.length) {
    filterDate.removeAttribute('min')
    return
  }

  const firstDate = allColors.reduce((earliest, color) => {
    return color.colorDate < earliest ? color.colorDate : earliest
  }, allColors[0].colorDate)

  filterDate.min = firstDate

  if (filterDate.value && filterDate.value < firstDate) {
    filterDate.value = ''
  }
}

async function loadWall() {
  const clientKey = getClientKey()
  const res = await fetch(`/api/wall?clientKey=${encodeURIComponent(clientKey)}`)
  const data = await res.json()
  allColors = data.colors ?? []
  updateDateFilterBounds()

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
    const unlikeBtn = node.querySelector('.unlike-btn')
    const errorEl = node.querySelector('.like-error')
    const nameInput = form.querySelector('input[name="name"]')

    node.dataset.colorDate = color.colorDate
    swatch.style.backgroundColor = color.hex
    hexEl.innerHTML = renderHexHtml(color.hex, getHexQuery())
    dateEl.textContent = formatDate(color.colorDate)
    likesEl.innerHTML = renderLikesHtml(color.likes, filterName.value.trim())

    if (color.likedByClient) {
      form.hidden = true
      unlikeBtn.hidden = false
    } else {
      form.hidden = false
      unlikeBtn.hidden = true
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      errorEl.hidden = true
      hideMessage(errorEl)
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
          showTemporaryMessage(errorEl, messages[result.error] || 'Like failed.')
          return
        }

        await loadWall()
      } catch {
        showTemporaryMessage(errorEl, 'Network error.')
      } finally {
        form.querySelector('button').disabled = false
      }
    })

    unlikeBtn.addEventListener('click', async () => {
      hideMessage(errorEl)
      unlikeBtn.disabled = true

      try {
        const response = await fetch('/api/unlike', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            colorId: color.id,
            clientKey: getClientKey(),
          }),
        })

        const result = await response.json()
        if (!response.ok || !result.ok) {
          const messages = {
            not_liked: 'You have not liked this color from this browser.',
            color_not_found: 'Color not found.',
          }
          showTemporaryMessage(errorEl, messages[result.error] || 'Unlike failed.')
          return
        }

        await loadWall()
      } catch {
        showTemporaryMessage(errorEl, 'Network error.')
      } finally {
        unlikeBtn.disabled = false
      }
    })

    wallEl.appendChild(node)
  }
}

filterForm.addEventListener('input', applyFilters)
filterForm.addEventListener('change', applyFilters)
filterClear.addEventListener('click', clearFilters)

function closeInfoPanel() {
  infoPanel.hidden = true
  infoToggle.setAttribute('aria-expanded', 'false')
}

function openInfoPanel() {
  infoPanel.hidden = false
  infoToggle.setAttribute('aria-expanded', 'true')
}

infoToggle.addEventListener('click', (event) => {
  event.stopPropagation()
  if (infoPanel.hidden) openInfoPanel()
  else closeInfoPanel()
})

infoClose.addEventListener('click', closeInfoPanel)

document.addEventListener('click', (event) => {
  if (infoPanel.hidden) return
  if (!event.target.closest('.info-popover')) closeInfoPanel()
})

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !infoPanel.hidden) closeInfoPanel()
})

sizeSlider.addEventListener('input', () => {
  setTileSize(Number(sizeSlider.value))
})

setTileSize(Number(sizeSlider.value))
updateFilterUi()
loadWall()
