function randomHexColor() {
  const r = Math.floor(Math.random() * 256)
  const g = Math.floor(Math.random() * 256)
  const b = Math.floor(Math.random() * 256)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase()
}

function getBudapestNow(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  })
  const parts = formatter.formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const day = get('day')
  const month = get('month')
  const year = get('year')
  return {
    date: `${year}-${month}-${day}`,
    hour: Number(get('hour')),
  }
}

export async function ensureDailyColor(db: D1Database) {
  const { date, hour } = getBudapestNow()
  if (hour !== 6) return { created: false, reason: 'not_6am' as const }

  const existing = await db
    .prepare('SELECT id FROM colors WHERE color_date = ?')
    .bind(date)
    .first()

  if (existing) return { created: false, reason: 'already_exists' as const }

  for (let attempt = 0; attempt < 64; attempt++) {
    const hex = randomHexColor()
    try {
      await db
        .prepare('INSERT INTO colors (hex, color_date) VALUES (?, ?)')
        .bind(hex, date)
        .run()
      return { created: true, hex, date }
    } catch {
      continue
    }
  }

  throw new Error('Could not generate unique color')
}

export type WallColor = {
  id: number
  hex: string
  colorDate: string
  likes: { name: string | null }[]
  likedByClient?: boolean
}

export async function fetchWall(db: D1Database, clientKey: string | null = null): Promise<WallColor[]> {
  const colorsResult = await db
    .prepare('SELECT id, hex, color_date AS colorDate FROM colors ORDER BY color_date DESC')
    .all<{ id: number; hex: string; colorDate: string }>()

  const colors = colorsResult.results ?? []
  if (colors.length === 0) return []

  const likesResult = await db
    .prepare('SELECT color_id AS colorId, name, client_key AS clientKey FROM likes ORDER BY id ASC')
    .all<{ colorId: number; name: string | null; clientKey: string }>()

  const likesByColor = new Map<number, { name: string | null }[]>()
  const likedColorIds = new Set<number>()

  for (const like of likesResult.results ?? []) {
    const list = likesByColor.get(like.colorId) ?? []
    list.push({ name: like.name })
    likesByColor.set(like.colorId, list)
    if (clientKey && like.clientKey === clientKey) {
      likedColorIds.add(like.colorId)
    }
  }

  return colors.map((color) => ({
    ...color,
    likes: likesByColor.get(color.id) ?? [],
    likedByClient: clientKey ? likedColorIds.has(color.id) : undefined,
  }))
}

export function normalizeName(raw: unknown) {
  if (raw == null) return null
  const name = String(raw).trim()
  if (!name) return null
  if (name.length > 40) return name.slice(0, 40)
  return name
}

export function normalizeClientKey(raw: unknown) {
  const key = String(raw ?? '').trim()
  if (key.length < 16 || key.length > 128) return null
  return key
}

export async function getFirstColorHex(db: D1Database): Promise<string | null> {
  const row = await db
    .prepare('SELECT hex FROM colors ORDER BY color_date ASC LIMIT 1')
    .first<{ hex: string }>()

  return row?.hex ?? null
}

export async function addLike(
  db: D1Database,
  colorId: number,
  clientKey: string,
  name: string | null,
) {
  const color = await db.prepare('SELECT id FROM colors WHERE id = ?').bind(colorId).first()
  if (!color) {
    return { ok: false as const, error: 'color_not_found' }
  }

  if (name) {
    const duplicateName = await db
      .prepare(
        "SELECT id FROM likes WHERE color_id = ? AND name IS NOT NULL AND lower(trim(name)) = lower(trim(?))",
      )
      .bind(colorId, name)
      .first()
    if (duplicateName) {
      return { ok: false as const, error: 'name_taken' }
    }
  }

  try {
    await db
      .prepare('INSERT INTO likes (color_id, client_key, name) VALUES (?, ?, ?)')
      .bind(colorId, clientKey, name)
      .run()
    return { ok: true as const }
  } catch {
    return { ok: false as const, error: 'already_liked' }
  }
}

export async function removeLike(db: D1Database, colorId: number, clientKey: string) {
  const color = await db.prepare('SELECT id FROM colors WHERE id = ?').bind(colorId).first()
  if (!color) {
    return { ok: false as const, error: 'color_not_found' }
  }

  const result = await db
    .prepare('DELETE FROM likes WHERE color_id = ? AND client_key = ?')
    .bind(colorId, clientKey)
    .run()

  if (!result.meta.changes) {
    return { ok: false as const, error: 'not_liked' }
  }

  return { ok: true as const }
}
