import { defineConfig } from '@playwright/test'

// End-to-end tests drive the real app in a real (headless) browser: FastAPI serving the
// built frontend, the real catalog index and a local Ollama. Seed and index first. Answers
// take seconds, so timeouts are generous.
export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  expect: { timeout: 60_000 },
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
