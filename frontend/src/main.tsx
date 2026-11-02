import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, useLoaderData } from 'react-router'
import { Layout, LayoutError } from './Layout.tsx'
import {
  adminLoader,
  categoriesAction,
  entryAction,
  entryLoader,
  locationAction,
  locationLoader,
  locationsAction,
  loginAction,
  loginLoader,
  logoutAction,
  newEntryAction,
  newEntryLoader,
  newLocationAction,
  organizationAction,
  requirementsAction,
} from './adminRoutes.ts'
import { getCategories, getEntry, getLocations, getOrganization } from './api.ts'
import { EntryError, EntryPage } from './pages/EntryPage.tsx'
import { HomeError, HomePage } from './pages/HomePage.tsx'
import { LocationsError, LocationsPage } from './pages/LocationsPage.tsx'
import { AdminEntriesPage } from './pages/admin/AdminEntriesPage.tsx'
import { AdminError, AdminLayout } from './pages/admin/AdminLayout.tsx'
import { AdminLocationsPage } from './pages/admin/AdminLocationsPage.tsx'
import { EntryFormPage } from './pages/admin/EntryFormPage.tsx'
import { LocationError, LocationFormPage } from './pages/admin/LocationFormPage.tsx'
import { NewEntryPage } from './pages/admin/NewEntryPage.tsx'
import { NewLocationPage } from './pages/admin/NewLocationPage.tsx'
import { OrganizationPage } from './pages/admin/OrganizationPage.tsx'
import { LoginPage } from './pages/admin/LoginPage.tsx'
import type {
  Admin,
  CategoryWithEntries,
  Entry,
  LocationWithEntries,
  Organization,
} from './types.ts'
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
  // Outside the public layout: no assistant panel, and none of the site's navigation.
  {
    path: '/admin',
    loader: adminLoader,
    Component: () => <AdminLayout admin={useLoaderData<Admin>()} />,
    ErrorBoundary: AdminError,
    HydrateFallback: () => null,
    // The same public endpoints the site reads: the admin edits what people see.
    children: [
      {
        index: true,
        loader: ({ request }) => getCategories(request.signal),
        action: categoriesAction,
        Component: () => <AdminEntriesPage categories={useLoaderData<CategoryWithEntries[]>()} />,
        ErrorBoundary: HomeError,
      },
      {
        path: 'entries/new',
        loader: newEntryLoader,
        action: newEntryAction,
        Component: () => <NewEntryPage {...useLoaderData<typeof newEntryLoader>()} />,
        ErrorBoundary: AdminError,
      },
      {
        path: 'entries/:slug',
        loader: entryLoader,
        action: entryAction,
        Component: () => <EntryFormPage {...useLoaderData<typeof entryLoader>()} />,
        ErrorBoundary: EntryError,
      },
      // No page: only the list editors' fetchers post here.
      { path: 'entries/:slug/requirements', action: requirementsAction },
      { path: 'entries/:slug/locations', action: locationsAction },
      {
        path: 'locations',
        loader: ({ request }) => getLocations(request.signal),
        Component: () => (
          <AdminLocationsPage locations={useLoaderData<LocationWithEntries[]>()} />
        ),
        ErrorBoundary: LocationsError,
      },
      {
        path: 'locations/new',
        action: newLocationAction,
        Component: NewLocationPage,
        ErrorBoundary: AdminError,
      },
      {
        path: 'locations/:slug',
        loader: locationLoader,
        action: locationAction,
        Component: () => <LocationFormPage location={useLoaderData<typeof locationLoader>()} />,
        ErrorBoundary: LocationError,
      },
      {
        path: 'organization',
        loader: ({ request }) => getOrganization(request.signal),
        action: organizationAction,
        Component: () => <OrganizationPage organization={useLoaderData<Organization>()} />,
        ErrorBoundary: AdminError,
      },
    ],
  },
  {
    path: '/admin/login',
    loader: loginLoader,
    action: loginAction,
    Component: LoginPage,
    ErrorBoundary: AdminError,
    HydrateFallback: () => null,
  },
  { path: '/admin/logout', action: logoutAction, ErrorBoundary: AdminError },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
