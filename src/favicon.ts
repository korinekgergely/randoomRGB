import { isValidHex } from './hex'

const DEFAULT_FAVICON_HEX = '#f4f4f4'

export function buildColorFaviconSvg(hex: string) {
  const fill = isValidHex(hex) ? hex : DEFAULT_FAVICON_HEX
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="${fill}"/></svg>`
}

export function getDefaultFaviconHex() {
  return DEFAULT_FAVICON_HEX
}
