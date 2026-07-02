import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Served from https://cowglow.github.io/basic-chat-bot-ui/ (a project
  // page, not a custom domain), so asset URLs need this prefix — otherwise
  // the built index.html requests /assets/... instead of
  // /basic-chat-bot-ui/assets/... and everything 404s.
  base: '/basic-chat-bot-ui/',
  test: {
    environment: 'node',
  },
})
