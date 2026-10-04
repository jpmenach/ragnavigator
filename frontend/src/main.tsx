import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, useLoaderData } from 'react-router'
import { Layout, LayoutError } from './Layout.tsx'
import { getCategories, getEntry, getLocations, getOrganization } from './api.ts'
import { EntryError, EntryPage } from './pages/EntryPage.tsx'
import { HomeError, HomePage } from './pages/HomePage.tsx'
import { LocationsError, LocationsPage } from './pages/LocationsPage.tsx'
import type { CategoryWithEntries, Entry, LocationWithEntries, Organization } from './types.ts'
import './index.css'

// Loaders fetch before the page renders, so a page never shows half-loaded. That also
// matters later: when the assistant navigates somewhere, the section to highlight is
// already on screen once navigation finishes.
const router = createBrowserRouter([
  {
    path: '/',
    loader: ({ request }) => getOrganization(request.signal),
    Component: () => <Layout organization={useLoaderData<Organization>()} />,
    ErrorBoundary: LayoutError,
    // Shown while the first loaders run. Blank on purpose: it's a fraction of a second, and
    // without the organization there's no header to show yet.
    HydrateFallback: () => null,
    children: [
      {
        index: true,
        loader: ({ request }) => getCategories(request.signal),
        Component: () => <HomePage categories={useLoaderData<CategoryWithEntries[]>()} />,
        ErrorBoundary: HomeError,
      },
      {
        path: 'entries/:slug',
        loader: ({ params, request }) => getEntry(params.slug!, request.signal),
        Component: () => <EntryPage entry={useLoaderData<Entry>()} />,
        // Rendered inside the layout, so a missing trámite still shows the header.
        ErrorBoundary: EntryError,
      },
      {
        path: 'locations',
        loader: ({ request }) => getLocations(request.signal),
        Component: () => <LocationsPage locations={useLoaderData<LocationWithEntries[]>()} />,
        ErrorBoundary: LocationsError,
      },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
