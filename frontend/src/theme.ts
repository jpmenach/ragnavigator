import type { Organization } from './types'

// Every color class (bg-primary, text-on-primary, bg-primary/5…) compiles to these CSS
// variables, so setting them on <html> re-themes the whole site without a rebuild. The
// values in index.css are only the fallback.
export function applyTheme(organization: Organization) {
  const root = document.documentElement.style
  root.setProperty('--color-primary', organization.primary_color)
  root.setProperty('--color-on-primary', textColorOn(organization.primary_color))
}

// White or black, whichever contrasts more with the background, using the WCAG
// relative-luminance formula. A light brand color (yellow) gets black text, a dark one
// white, without anyone having to pick.
export function textColorOn(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const contrastWithWhite = 1.05 / (luminance + 0.05)
  const contrastWithBlack = (luminance + 0.05) / 0.05
  return contrastWithWhite >= contrastWithBlack ? '#ffffff' : '#000000'
}
