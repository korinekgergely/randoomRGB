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
const labelsToggle = document.getElementById('labelsToggle')
const colorImmersiveEl = document.getElementById('colorImmersive')

const CLIENT_KEY_STORAGE = 'colorWallClientKey'
const TILE_SIZE_STORAGE = 'colorWallTileSize'
const LABELS_HIDDEN_STORAGE = 'colorWallLabelsHidden'
const MESSAGE_HIDE_MS = 30000
const TILE_SIZE_MIN = 20
const TILE_SIZE_MAX = 280
const TILE_SIZE_DEFAULT = 120
const TILE_SIZE_LABELS_THRESHOLD = TILE_SIZE_DEFAULT

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

  const labels = []
  let hasAnonymous = false

  for (const like of likes) {
    if (like.name) labels.push(like.name)
    else hasAnonymous = true
  }

  if (hasAnonymous) labels.push('Anonymous')

  const rendered = labels.map((label) =>
    nameQuery ? highlightSubstring(label, nameQuery) : escapeHtml(label),
  )

  return `${likes.length} like · ${rendered.join(', ')}`
}

function formatDate(isoDate) {
  return isoDate
}

function setTileSize(px) {
  document.documentElement.style.setProperty('--tile-size', `${px}px`)
}

function loadTileSize() {
  const stored = Number(localStorage.getItem(TILE_SIZE_STORAGE))
  const size = Number.isFinite(stored)
    ? Math.min(TILE_SIZE_MAX, Math.max(TILE_SIZE_MIN, stored))
    : TILE_SIZE_DEFAULT
  sizeSlider.value = String(size)
  setTileSize(size)
}

function saveTileSize() {
  localStorage.setItem(TILE_SIZE_STORAGE, sizeSlider.value)
}

async function copyToClipboard(text, button, failLabel = 'Failed') {
  const originalLabel = button.getAttribute('aria-label') ?? ''
  try {
    await navigator.clipboard.writeText(text)
    button.setAttribute('aria-label', 'Copied!')
    window.setTimeout(() => {
      button.setAttribute('aria-label', originalLabel)
    }, 1500)
  } catch {
    button.setAttribute('aria-label', failLabel)
    window.setTimeout(() => {
      button.setAttribute('aria-label', originalLabel)
    }, 1500)
  }
}

function buildColorShareUrl(colorDate) {
  const url = new URL(window.location.origin + window.location.pathname)
  url.searchParams.set('date', colorDate)
  return url.toString()
}

async function copyHexValue(hex, button) {
  await copyToClipboard(hex, button)
}

async function copyShareUrl(colorDate, button) {
  await copyToClipboard(buildColorShareUrl(colorDate), button)
}

function isMobileLayout() {
  return window.matchMedia('(max-width: 480px)').matches
}

function getSliderTileSize() {
  return Number(sizeSlider.value)
}

function syncLabelsToggleUi() {
  const hidden = document.body.classList.contains('labels-hidden')
  const forcedBySize = getSliderTileSize() < TILE_SIZE_LABELS_THRESHOLD
  labelsToggle.textContent = hidden ? 'Show labels' : 'Hide labels'
  labelsToggle.setAttribute('aria-pressed', hidden ? 'true' : 'false')
  labelsToggle.disabled = forcedBySize
}

function applyLabelsState() {
  const userHidden = localStorage.getItem(LABELS_HIDDEN_STORAGE) === '1'
  const hidden = getSliderTileSize() < TILE_SIZE_LABELS_THRESHOLD || userHidden
  document.body.classList.toggle('labels-hidden', hidden)
  syncLabelsToggleUi()
}

function setLabelsHidden(hidden) {
  localStorage.setItem(LABELS_HIDDEN_STORAGE, hidden ? '1' : '0')
  applyLabelsState()
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
  syncDateToUrl()
}

function clearFilters() {
  filterDate.value = ''
  filterHex.value = ''
  filterName.value = ''
  clearFilterMessage()
  updateFilterUi()
  syncDateToUrl()
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
    syncDateToUrl()
  }
}

function isValidIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function readDateFromUrl() {
  const date = new URLSearchParams(window.location.search).get('date')
  if (!date || !isValidIsoDate(date)) return ''
  if (filterDate.min && date < filterDate.min) return ''
  return date
}

function syncDateToUrl() {
  const url = new URL(window.location.href)
  if (filterDate.value) url.searchParams.set('date', filterDate.value)
  else url.searchParams.delete('date')
  window.history.replaceState(null, '', url)
}

function applyDateFromUrl() {
  const date = readDateFromUrl()
  if (!date) return
  filterDate.value = date
}

async function loadWall() {
  const clientKey = getClientKey()
  const res = await fetch(`/api/wall?clientKey=${encodeURIComponent(clientKey)}`)
  const data = await res.json()
  allColors = data.colors ?? []
  updateDateFilterBounds()
  applyDateFromUrl()

  if (hasActiveFilters()) {
    applyFilters()
    return
  }

  renderWall(allColors)
}

function exitColorImmersive() {
  colorImmersiveEl.hidden = true
  document.body.classList.remove('color-immersive')
}

function enterColorImmersive(hex) {
  colorImmersiveEl.style.backgroundColor = hex
  colorImmersiveEl.hidden = false
  document.body.classList.add('color-immersive')
}

function renderWall(colors) {
  exitColorImmersive()
  wallEl.replaceChildren()

  for (const color of colors) {
    const node = tileTemplate.content.firstElementChild.cloneNode(true)
    const swatch = node.querySelector('.swatch')
    const swatchHexWhite = node.querySelector('.swatch-hex-white')
    const swatchHexBlack = node.querySelector('.swatch-hex-black')
    const hexEl = node.querySelector('.hex')
    const copyHexBtn = node.querySelector('.copy-hex-btn')
    const shareColorBtn = node.querySelector('.share-color-btn')
    const dateEl = node.querySelector('.date')
    const likesEl = node.querySelector('.likes')
    const form = node.querySelector('.like-form')
    const unlikeBtn = node.querySelector('.unlike-btn')
    const errorEl = node.querySelector('.like-error')
    const nameInput = form.querySelector('input[name="name"]')

    node.dataset.colorDate = color.colorDate
    swatch.style.backgroundColor = color.hex
    swatch.addEventListener('click', () => enterColorImmersive(color.hex))
    swatchHexWhite.textContent = color.hex
    swatchHexBlack.textContent = color.hex
    hexEl.innerHTML = renderHexHtml(color.hex, getHexQuery())
    copyHexBtn.addEventListener('click', () => copyHexValue(color.hex, copyHexBtn))
    shareColorBtn.addEventListener('click', () => copyShareUrl(color.colorDate, shareColorBtn))
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
  if (event.key !== 'Escape') return
  if (!infoPanel.hidden) closeInfoPanel()
  else if (document.body.classList.contains('color-immersive')) exitColorImmersive()
})

colorImmersiveEl.addEventListener('click', exitColorImmersive)

sizeSlider.addEventListener('input', () => {
  setTileSize(Number(sizeSlider.value))
  saveTileSize()
  applyLabelsState()
})

labelsToggle.addEventListener('click', () => {
  setLabelsHidden(localStorage.getItem(LABELS_HIDDEN_STORAGE) !== '1')
})

window.matchMedia('(max-width: 480px)').addEventListener('change', applyLabelsState)
window.addEventListener('resize', applyLabelsState)

loadTileSize()
applyLabelsState()
updateFilterUi()
loadWall()
