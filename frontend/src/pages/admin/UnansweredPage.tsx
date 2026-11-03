import { useFetcher } from 'react-router'
import type { UnansweredQuestion } from '../../types'

// In the admin's own time zone, which the browser knows; the API sends UTC.
const WHEN = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' })

export function UnansweredPage({ questions }: { questions: UnansweredQuestion[] }) {
  return (
    <>
      <h1 className="text-2xl font-bold">Preguntas sin respuesta</h1>
      <p className="mt-1 max-w-2xl text-gray-600">
        Lo que la gente preguntó y el catálogo no pudo responder. Cuando agregues ese
        contenido, descarta la pregunta.
      </p>
      {questions.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">No hay preguntas pendientes.</p>
      ) : (
        <ul className="mt-6 max-w-3xl divide-y divide-gray-200 border-y border-gray-200">
          {questions.map((question) => (
            <Question key={question.id} question={question} />
          ))}
        </ul>
      )}
    </>
  )
}

// Its own fetcher: dismissing one doesn't wait for, or block, the others.
function Question({ question }: { question: UnansweredQuestion }) {
  const fetcher = useFetcher()
  // Hidden as soon as it's dismissed, without waiting for the list to reload.
  if (fetcher.state !== 'idle') {
    return null
  }

  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-2 py-3">
      <div>
        <p>{question.question}</p>
        <time dateTime={question.asked_at} className="text-sm text-gray-500">
          {WHEN.format(new Date(question.asked_at))}
        </time>
      </div>
      <fetcher.Form method="post">
        <input type="hidden" name="id" value={question.id} />
        <button type="submit" className="text-sm text-gray-600 hover:underline">
          Descartar
        </button>
      </fetcher.Form>
    </li>
  )
}
