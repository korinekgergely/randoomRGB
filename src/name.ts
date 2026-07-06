const NAME_PART = /[\p{L}\p{N}']/u
const NAME_MAX_LENGTH = 30

export function sanitizeDisplayName(raw: string) {
  let name = ''
  for (const ch of raw.trim()) {
    if (NAME_PART.test(ch)) {
      name += ch
    } else if (ch === ' ' && name.length > 0 && !name.endsWith(' ')) {
      name += ' '
    }
    if (name.length >= NAME_MAX_LENGTH) break
  }
  return name.trim()
}

export function normalizeName(raw: unknown) {
  if (raw == null) return null
  const name = sanitizeDisplayName(String(raw))
  if (!name) return null
  return name
}
