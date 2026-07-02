import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { plugin as markdown, Mode } from 'vite-plugin-markdown'

// https://vite.dev/config/
export default defineConfig({
  // Mode.HTML compiles README.md to an HTML string at build time (via
  // markdown-it), so ReadmeButton.tsx can `import { html } from
  // "../README.md"` with no markdown parser shipped to the client.
  plugins: [react(), markdown({ mode: [Mode.HTML] })],
  // Served from https://cowglow.github.io/basic-chat-bot-ui/ (a project
  // page, not a custom domain), so asset URLs need this prefix — otherwise
  // the built index.html requests /assets/... instead of
  // /basic-chat-bot-ui/assets/... and everything 404s.
  base: '/basic-chat-bot-ui/',
  test: {
    environment: 'node',
  },
})
