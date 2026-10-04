import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { askQuestion } from '../api'
import { describe, highlight, suggestionLabel } from '../assistantActions'
import type { Action } from '../types'

type Message = {
  role: 'user' | 'assistant'
  text: string
  // Assistant messages only: the actions that came with the answer, and whether the ones
  // that move the page have run (right away with auto-navigation, otherwise on click).
  actions?: Action[]
  ran?: boolean
}

// Shown instead of a guess when the catalog doesn't answer the question.
const NOT_FOUND = 'No tengo esa información en el catálogo de trámites.'
const FAILED = 'No pude responder ahora. Intenta de nuevo en unos minutos.'

// A personal preference, so it stays in this browser. Storage can be blocked (private
// windows, strict settings); the panel then just uses the default.
const AUTO_NAVIGATE_KEY = 'ragnavigator.autoNavigate'

function readAutoNavigate(): boolean {
  try {
    return localStorage.getItem(AUTO_NAVIGATE_KEY) !== 'false'
  } catch {
    return true
  }
}

function writeAutoNavigate(value: boolean) {
  try {
    localStorage.setItem(AUTO_NAVIGATE_KEY, String(value))
  } catch {
    // Not remembered; it still applies for this visit.
  }
}

// Lives in the layout, which stays mounted across pages, so the conversation survives
// navigation (including the navigation the assistant itself will trigger).
export function AssistantPanel() {
  const [messages, setMessages] = useState<Message[]>([])
  const [question, setQuestion] = useState('')
  const [pending, setPending] = useState(false)
  // Small screens only: the panel is a bottom sheet behind a button. Always shown on large.
  const [open, setOpen] = useState(false)
  // On by default: taking the user to the answer is the point. Off, it only suggests.
  const [autoNavigate, setAutoNavigate] = useState(readAutoNavigate)
  const listRef = useRef<HTMLOListElement>(null)
  const navigate = useNavigate()

  // Keep the latest message in view. Scrolls the list itself, not the page.
  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages, pending])

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = question.trim()
    if (!text || pending) return
    setMessages((previous) => [...previous, { role: 'user', text }])
    setQuestion('')
    setPending(true)
    try {
      const response = await askQuestion(text)
      const reply = response.grounded ? response.answer : NOT_FOUND
      const { actions } = response
      setMessages((previous) => [
        ...previous,
        { role: 'assistant', text: reply, actions, ran: autoNavigate },
      ])
      if (autoNavigate) await runActions(actions)
    } catch {
      setMessages((previous) => [...previous, { role: 'assistant', text: FAILED }])
    } finally {
      setPending(false)
    }
  }

  function changeAutoNavigate(value: boolean) {
    setAutoNavigate(value)
    writeAutoNavigate(value)
  }

  // The suggestion button: run that answer's actions now, and show them as done.
  async function follow(index: number) {
    const { actions = [] } = messages[index]
    setMessages((previous) =>
      previous.map((message, i) => (i === index ? { ...message, ran: true } : message)),
    )
    await runActions(actions)
  }

  // Every action only shows something (none changes data), so they run without asking.
  async function runActions(actions: Action[]) {
    for (const action of actions) {
      if (action.type === 'navigate') {
        // Resolves once the new page's loader has run, so the section to highlight exists.
        await navigate(action.to)
      } else if (action.type === 'highlight') {
        await highlight(action.target)
      }
    }
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed right-4 bottom-4 z-10 rounded-full bg-primary px-5 py-3 font-medium text-on-primary shadow-lg lg:hidden"
        >
          Preguntar
        </button>
      )}

      <aside
        className={`${open ? 'flex' : 'hidden'} fixed inset-x-0 bottom-0 z-10 h-[70vh] flex-col rounded-t-xl border border-gray-200 bg-white shadow-lg lg:sticky lg:top-4 lg:flex lg:h-[calc(100vh-8rem)] lg:self-start lg:rounded-xl lg:shadow-none`}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="font-semibold">Asistente</h2>
          <label className="ml-auto flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={autoNavigate}
              onChange={(event) => changeAutoNavigate(event.target.checked)}
              className="accent-primary"
            />
            Llevarme a la respuesta
          </label>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="ml-4 text-sm text-gray-600 hover:underline lg:hidden"
          >
            Cerrar
          </button>
        </div>

        <ol ref={listRef} aria-live="polite" className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && (
            <li className="text-sm text-gray-600">
              Pregúntame por requisitos, costos, lugares u horarios de cualquier trámite.
            </li>
          )}
          {messages.map((message, index) => (
            <MessageItem key={index} message={message} onFollow={() => follow(index)} />
          ))}
          {pending && <li className="mr-8 text-sm text-gray-500">Buscando…</li>}
        </ol>

        <form onSubmit={send} className="flex gap-2 border-t border-gray-200 p-3">
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={500}
            placeholder="Escribe tu pregunta"
            aria-label="Tu pregunta"
            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            disabled={pending || !question.trim()}
            className="rounded-lg bg-primary px-4 py-2 font-medium text-on-primary disabled:opacity-50"
          >
            Enviar
          </button>
        </form>
      </aside>
    </>
  )
}

function MessageItem({ message, onFollow }: { message: Message; onFollow: () => void }) {
  const actions = message.actions ?? []
  const pageActions = actions.filter((action) => action.type !== 'offer_download')
  const downloads = actions.filter((action) => action.type === 'offer_download')

  if (message.role === 'user') {
    return <li className="ml-8 rounded-lg bg-primary px-3 py-2 text-on-primary">{message.text}</li>
  }
  return (
    <li className="mr-8 rounded-lg bg-gray-100 px-3 py-2">
      {message.text}
      {pageActions.length > 0 && message.ran && (
        <ul className="mt-2 space-y-0.5 text-sm text-gray-500">
          {pageActions.map((action) => (
            <li key={action.type}>→ {describe(action)}</li>
          ))}
        </ul>
      )}
      {pageActions.length > 0 && !message.ran && (
        <button
          type="button"
          onClick={onFollow}
          className="mt-2 block rounded-lg border border-primary px-3 py-1 text-sm font-medium text-primary hover:bg-primary/5"
        >
          {suggestionLabel(pageActions)}
        </button>
      )}
      {downloads.map((download) => (
        <a
          key={download.url}
          href={download.url}
          className="mt-2 block text-sm font-medium text-primary hover:underline"
        >
          {download.label}
        </a>
      ))}
    </li>
  )
}
