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
const sortSelect = document.getElementById('sortSelect')
const sortClear = document.getElementById('sortClear')
const siteTitle = document.getElementById('siteTitle')
const toolbarEl = document.querySelector('.toolbar')
const colorImmersiveEl = document.getElementById('colorImmersive')

const CLIENT_KEY_STORAGE = 'colorWallClientKey'
const LIKE_NAME_STORAGE = 'colorWallLikeName'
const TILE_SIZE_STORAGE = 'colorWallTileSize'
const LABELS_HIDDEN_STORAGE = 'colorWallLabelsHidden'
const SORT_STORAGE = 'colorWallSortMode'
const SORT_MODES = ['date-desc', 'date-asc', 'hex-asc', 'hex-desc', 'likes-desc', 'likes-asc']
const SORT_DEFAULT = 'date-desc'
const MESSAGE_HIDE_MS = 30000
const ACTION_FEEDBACK_MS = 10000
const TILE_SIZE_MIN = 20
const TILE_SIZE_MAX = 280
const TILE_SIZE_DEFAULT = TILE_SIZE_MAX
const TILE_SIZE_LABELS_THRESHOLD = 120
const TOOLBAR_SCROLL_DELTA = 6
const TOOLBAR_AUTO_HIDE_MQ = '(max-width: 857px)'

let allColors = []
const messageTimers = new WeakMap()
const actionFeedbackTimers = new WeakMap()

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
    .replace(/'/g, '&#39;')
}

function sanitizeDisplayName(raw) {
  const namePart = /[\p{L}\p{N}']/u
  let name = ''
  for (const ch of raw.trim()) {
    if (namePart.test(ch)) {
      name += ch
    } else if (ch === ' ' && name.length > 0 && !name.endsWith(' ')) {
      name += ' '
    }
    if (name.length >= 30) break
  }
  return name.trim()
}

function getSavedLikeName() {
  const stored = localStorage.getItem(LIKE_NAME_STORAGE)
  if (!stored) return ''
  return sanitizeDisplayName(stored)
}

function saveLikeName(raw) {
  const name = sanitizeDisplayName(raw)
  if (!name) return
  localStorage.setItem(LIKE_NAME_STORAGE, name)
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

function buildFaviconDataUrl(hex) {
  const fill = /^#[0-9A-F]{6}$/.test(hex) ? hex : '#f4f4f4'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="${fill}"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function updatePageFavicon() {
  const latest = allColors[0]
  if (!latest) return
  const href = buildFaviconDataUrl(latest.hex)
  for (const link of document.querySelectorAll('link[rel="icon"]')) {
    link.href = href
  }
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

function showActionFeedback(button, type) {
  const existing = actionFeedbackTimers.get(button)
  if (existing) window.clearTimeout(existing)

  const originalLabel = button.getAttribute('aria-label') ?? ''
  button.classList.remove('hex-action-btn--success', 'hex-action-btn--error')
  button.classList.add(type === 'success' ? 'hex-action-btn--success' : 'hex-action-btn--error')
  button.setAttribute('aria-label', type === 'success' ? 'Copied!' : 'Failed')

  const timer = window.setTimeout(() => {
    button.classList.remove('hex-action-btn--success', 'hex-action-btn--error')
    button.setAttribute('aria-label', originalLabel)
    actionFeedbackTimers.delete(button)
  }, ACTION_FEEDBACK_MS)

  actionFeedbackTimers.set(button, timer)
}

async function copyToClipboard(text, button) {
  try {
    await navigator.clipboard.writeText(text)
    showActionFeedback(button, 'success')
  } catch {
    showActionFeedback(button, 'error')
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

function canUseNativeShare(data) {
  if (!navigator.share) return false
  if (typeof navigator.canShare === 'function') return navigator.canShare(data)
  return true
}

async function shareColorUrl(color, button) {
  const url = buildColorShareUrl(color.colorDate)
  const shareData = {
    title: 'randoomRGB',
    text: `${color.hex} — ${color.colorDate}`,
    url,
  }

  if (canUseNativeShare(shareData)) {
    try {
      await navigator.share(shareData)
      showActionFeedback(button, 'success')
      return
    } catch (err) {
      if (err?.name === 'AbortError') return
    }
  }

  await copyToClipboard(url, button)
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

function hexSortKey(hex) {
  return hex.toUpperCase().replace(/^#/, '')
}

function likeCount(color) {
  return color.likes.length
}

function sortColors(colors) {
  const mode = sortSelect.value
  const sorted = [...colors]

  if (mode === 'date-asc') {
    sorted.sort((a, b) => a.colorDate.localeCompare(b.colorDate))
    return sorted
  }
  if (mode === 'hex-asc') {
    sorted.sort((a, b) => hexSortKey(a.hex).localeCompare(hexSortKey(b.hex)))
    return sorted
  }
  if (mode === 'hex-desc') {
    sorted.sort((a, b) => hexSortKey(b.hex).localeCompare(hexSortKey(a.hex)))
    return sorted
  }
  if (mode === 'likes-desc') {
    sorted.sort((a, b) => {
      const diff = likeCount(b) - likeCount(a)
      return diff !== 0 ? diff : b.colorDate.localeCompare(a.colorDate)
    })
    return sorted
  }
  if (mode === 'likes-asc') {
    sorted.sort((a, b) => {
      const diff = likeCount(a) - likeCount(b)
      return diff !== 0 ? diff : b.colorDate.localeCompare(a.colorDate)
    })
    return sorted
  }

  sorted.sort((a, b) => b.colorDate.localeCompare(a.colorDate))
  return sorted
}

function getDisplayColors() {
  return sortColors(getFilteredColors())
}

function loadSortMode() {
  const stored = localStorage.getItem(SORT_STORAGE)
  sortSelect.value = SORT_MODES.includes(stored) ? stored : SORT_DEFAULT
}

function saveSortMode() {
  localStorage.setItem(SORT_STORAGE, sortSelect.value)
}

function clearFilterMessage() {
  hideMessage(filterMessage)
}

function showFilterMessage(text) {
  showTemporaryMessage(filterMessage, text)
}

function hasActiveSort() {
  return sortSelect.value !== SORT_DEFAULT
}

function updateFilterUi() {
  filterClear.hidden = !hasActiveFilters()
}

function updateSortUi() {
  sortClear.hidden = !hasActiveSort()
}

function updateToolbarUi() {
  updateFilterUi()
  updateSortUi()
}

function refreshWallDisplay() {
  const colors = getDisplayColors()
  const active = hasActiveFilters()

  if (active && colors.length === 0) {
    showFilterMessage('No matching colors.')
  } else {
    clearFilterMessage()
  }

  updateToolbarUi()
  renderWall(colors)
}

function applyFilters() {
  refreshWallDisplay()
  syncDateToUrl()
}

function resetToDefaultView() {
  localStorage.setItem(SORT_STORAGE, SORT_DEFAULT)
  window.location.href = window.location.origin + window.location.pathname
}

function clearSort() {
  sortSelect.value = SORT_DEFAULT
  saveSortMode()
  refreshWallDisplay()
}

function clearFilters() {
  filterDate.value = ''
  filterHex.value = ''
  filterName.value = ''
  clearFilterMessage()
  updateToolbarUi()
  syncDateToUrl()
  refreshWallDisplay()
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
  updatePageFavicon()
  updateDateFilterBounds()
  applyDateFromUrl()
  refreshWallDisplay()
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
    shareColorBtn.addEventListener('click', () => shareColorUrl(color, shareColorBtn))
    dateEl.textContent = formatDate(color.colorDate)
    likesEl.innerHTML = renderLikesHtml(color.likes, filterName.value.trim())

    if (color.likedByClient) {
      form.hidden = true
      unlikeBtn.hidden = false
    } else {
      form.hidden = false
      unlikeBtn.hidden = true
      const savedName = getSavedLikeName()
      if (savedName) nameInput.value = savedName
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      errorEl.hidden = true
      hideMessage(errorEl)
      form.querySelector('button').disabled = true

      try {
        const likedName = sanitizeDisplayName(nameInput.value)
        const response = await fetch('/api/like', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            colorId: color.id,
            clientKey: getClientKey(),
            name: likedName || null,
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

        if (likedName) saveLikeName(likedName)
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
sortClear.addEventListener('click', clearSort)
siteTitle.addEventListener('click', (event) => {
  event.preventDefault()
  resetToDefaultView()
})
sortSelect.addEventListener('change', () => {
  saveSortMode()
  refreshWallDisplay()
})

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

const mobileToolbarMq = window.matchMedia(TOOLBAR_AUTO_HIDE_MQ)
let lastScrollY = 0
let toolbarHidden = false
let toolbarScrollLock = false

function syncToolbarLayout() {
  if (!mobileToolbarMq.matches) {
    document.body.classList.remove('toolbar-hidden')
    toolbarHidden = false
    document.documentElement.style.removeProperty('--toolbar-offset')
    return
  }

  if (!toolbarHidden) {
    document.documentElement.style.setProperty('--toolbar-offset', `${toolbarEl.offsetHeight}px`)
  }
}

function setToolbarHidden(hidden) {
  if (!mobileToolbarMq.matches) return
  if (toolbarHidden === hidden) return

  const height = toolbarEl.offsetHeight
  const scrollY = window.scrollY
  toolbarHidden = hidden
  document.body.classList.toggle('toolbar-hidden', hidden)
  document.documentElement.style.setProperty('--toolbar-offset', hidden ? '0px' : `${height}px`)

  if (hidden) {
    window.scrollTo(0, Math.max(0, scrollY - height))
  } else {
    window.scrollTo(0, scrollY <= 4 ? 0 : scrollY + height)
  }

  lastScrollY = window.scrollY
  toolbarScrollLock = true
  window.setTimeout(() => {
    toolbarScrollLock = false
    lastScrollY = window.scrollY
  }, 320)
}

function handleToolbarScroll() {
  if (!mobileToolbarMq.matches) return
  if (toolbarScrollLock) return
  if (document.body.classList.contains('color-immersive')) return

  const y = window.scrollY
  if (y <= 4) {
    setToolbarHidden(false)
    return
  }

  const delta = y - lastScrollY
  if (delta > TOOLBAR_SCROLL_DELTA) setToolbarHidden(true)
  else if (delta < -TOOLBAR_SCROLL_DELTA) setToolbarHidden(false)

  lastScrollY = y
}

window.addEventListener('scroll', handleToolbarScroll, { passive: true })
mobileToolbarMq.addEventListener('change', () => {
  lastScrollY = window.scrollY
  syncToolbarLayout()
})
window.addEventListener('resize', syncToolbarLayout)
new ResizeObserver(syncToolbarLayout).observe(toolbarEl)

loadTileSize()
loadSortMode()
applyLabelsState()
updateToolbarUi()
syncToolbarLayout()
loadWall()
