# Chat Bot UI

![screencapture.png](screencapture.png)

A mock AI chat interface built with React, TypeScript, and Vite: no
network calls, no real model. A fake "bot" (`src/mockBot.ts`) returns
random Lorem Ipsum after a random delay, revealed word by word. The
point isn't the bot — it's a stand-in so you can study the **UI
mechanics** that every real AI chat product (ChatGPT, Claude, etc.) is
built on, without an API key or a network dependency getting in the way.

## Getting started

```bash
npm install
npm run dev      # start the dev server
npm run test     # run the test suite (vitest)
npm run lint      # lint the project
npm run build     # type-check and build for production
```

## Project structure

- `src/mockBot.ts` — fakes a streaming AI reply (random text, random
  delays) with no network involved.
- `src/chat/ChatStore.ts` — the conversation's state machine (messages,
  `botPhase`, streaming), implemented as a plain TypeScript class with
  **no dependency on React**.
- `src/chat/useChat.ts` — the thin hook that wires `ChatStore` into
  React via `useSyncExternalStore`.
- `src/App.tsx` — pure rendering: turns `useChat()`'s snapshot into
  markup, with no conversation logic of its own.
- `src/index.css` — layout-first styling (see [CONCEPTS.md](CONCEPTS.md) §6).

## Docs

- **[CONCEPTS.md](CONCEPTS.md)** — the UI fundamentals this project
  exists to teach: state as the source of truth, the
  thinking/streaming state machine, why messages need stable ids,
  layout-only CSS, and the accessibility work (live regions, focus
  management, labels) needed for a chat UI specifically.
- **[USE_SYNC_EXTERNAL_STORE.md](USE_SYNC_EXTERNAL_STORE.md)** — a deep
  dive on `useSyncExternalStore`, the hook that connects `ChatStore` to
  React: the problem it solves, the subscribe/getSnapshot contract, the
  snapshot-stability rule that causes infinite loops if you get it
  wrong, and why this split makes the store trivially testable without
  any React test utilities.

## Tooling notes

This project was scaffolded from the standard Vite React + TypeScript
template (HMR, ESLint). Two official Vite plugins are available for
Fast Refresh:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

### Expanding the ESLint configuration

If you are developing a production application, consider updating the
configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```