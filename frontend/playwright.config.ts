import { defineConfig } from '@playwright/test'

// End-to-end tests drive the real app in a real (headless) browser: FastAPI serving the
// built frontend and the seeded catalog. The tests replace /api/ask with fixed answers, so
// they need neither Ollama nor the index.
export default defineConfig({
  testDir: 'e2e',
  use: {
    // Not 8000, so a `fastapi dev` running for development doesn't get in the way.
    baseURL: 'http://localhost:8001',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run build && cd .. && uv run fastapi run src/ragnavigator/main.py --port 8001',
    url: 'http://localhost:8001/api/organization',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
