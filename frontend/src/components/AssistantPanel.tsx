import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { askQuestion } from '../api'

type Message = { role: 'user' | 'assistant'; text: string }

// Shown instead of a guess when the catalog doesn't answer the question.
const NOT_FOUND = 'No tengo esa información en el catálogo de trámites.'
const FAILED = 'No pude responder ahora. Intenta de nuevo en unos minutos.'

// Lives in the layout, which stays mounted across pages, so the conversation survives
// navigation (including the navigation the assistant itself will trigger).
export function AssistantPanel() {
  const [messages, setMessages] = useState<Message[]>([])
  const [question, setQuestion] = useState('')
  const [pending, setPending] = useState(false)
  // Small screens only: the panel is a bottom sheet behind a button. Always shown on large.
  const [open, setOpen] = useState(false)
  const listRef = useRef<HTMLOListElement>(null)

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
      setMessages((previous) => [...previous, { role: 'assistant', text: reply }])
    } catch {
      setMessages((previous) => [...previous, { role: 'assistant', text: FAILED }])
    } finally {
      setPending(false)
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
        className={`${open ? 'flex' : 'hidden'} fixed inset-x-0 bottom-0 z-10 h-[70vh] flex-col rounded-t-xl border border-gray-200 bg-white shadow-lg lg:sticky lg:top-4 lg:flex lg:h-[calc(100vh-2rem)] lg:self-start lg:rounded-xl lg:shadow-none`}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="font-semibold">Asistente</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-sm text-gray-600 hover:underline lg:hidden"
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
            <li
              key={index}
              className={
                message.role === 'user'
                  ? 'ml-8 rounded-lg bg-primary px-3 py-2 text-on-primary'
                  : 'mr-8 rounded-lg bg-gray-100 px-3 py-2'
              }
            >
              {message.text}
            </li>
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
