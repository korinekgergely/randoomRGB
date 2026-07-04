const VALID_HEX = /^#[0-9A-F]{6}$/

export function isValidHex(hex: string) {
  return VALID_HEX.test(hex)
}
