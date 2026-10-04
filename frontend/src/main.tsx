import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, useLoaderData } from 'react-router'
import App from './App.tsx'
import { Layout } from './Layout.tsx'
import { getEntry } from './api.ts'
import { EntryError, EntryPage } from './pages/EntryPage.tsx'
import type { Entry } from './types.ts'
import './index.css'

// Loaders fetch before the page renders, so a page never shows half-loaded. That also
// matters later: when the assistant navigates somewhere, the section to highlight is
// already on screen once navigation finishes.
const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: App },
      {
        path: 'tramites/:slug',
        loader: ({ params, request }) => getEntry(params.slug!, request.signal),
        Component: () => <EntryPage entry={useLoaderData<Entry>()} />,
        // Rendered inside the layout, so a missing trámite still shows the header.
        ErrorBoundary: EntryError,
      },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
