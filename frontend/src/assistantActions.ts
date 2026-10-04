import type { Action } from './types'

// How each section the assistant can point at is named in the panel's log.
const SECTION_NAMES: Record<string, string> = {
  requirements: 'los requisitos',
  'where-and-when': 'dónde y cuándo',
  notes: 'las notas',
}

// One line for the panel's log, so the page moving on its own never feels random.
// Downloads aren't logged: they're offered as a button instead of done.
export function describe(action: Action): string | null {
  switch (action.type) {
    case 'navigate':
      return action.to.startsWith('/locations') ? 'Abrí Lugares' : 'Abrí el trámite'
    case 'highlight':
      return `Resalté ${SECTION_NAMES[action.target] ?? 'el lugar'}`
    case 'offer_download':
      return null
  }
}

// The button shown instead of moving the page, when the user turned auto-navigation off.
export function suggestionLabel(actions: Action[]): string {
  const destination = actions.find((action) => action.type === 'navigate')
  const section = actions.find((action) => action.type === 'highlight')
  if (destination?.to.startsWith('/locations')) return 'Ver el lugar'
  if (section) return `Ver ${SECTION_NAMES[section.target] ?? 'la sección'}`
  return 'Ver el trámite'
}

// Plays the highlight animation on an element of the current page. Done on the DOM
// directly: it's a moment of decoration, not state React needs to keep.
export async function highlight(id: string) {
  const element = await waitForElement(id)
  if (!element) return
  // Restart the animation if the same section is highlighted twice in a row.
  element.classList.remove('assistant-highlight')
  void element.offsetWidth
  element.classList.add('assistant-highlight')
  element.addEventListener(
    'animationend',
    () => element.classList.remove('assistant-highlight'),
    { once: true },
  )
}

// `await navigate()` resolves when the router is done, which can be before React has put
// the new page on screen: checked in a browser, the section didn't exist yet at that point.
// So look for it on each frame, for at most two seconds.
function waitForElement(id: string, timeoutMs = 2000): Promise<HTMLElement | null> {
  const start = performance.now()
  return new Promise((resolve) => {
    const check = () => {
      const element = document.getElementById(id)
      if (element || performance.now() - start > timeoutMs) resolve(element)
      else requestAnimationFrame(check)
    }
    check()
  })
}
