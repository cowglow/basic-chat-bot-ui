# Chat UI fundamentals

This project is a mock AI chat interface: no network calls, no real model.
A fake "bot" (`src/mockBot.ts`) returns random Lorem Ipsum after a random
delay, revealed word by word. The point isn't the bot — it's using the
bot as a stand-in so you can study the **UI mechanics** that every real
AI chat product (ChatGPT, Claude, etc.) is built on, without an API key
or a network dependency getting in the way.

> **Note:** the conversation logic described below now lives in
> `src/chat/ChatStore.ts`, a plain class with no React dependency,
> instead of directly inside `App.tsx`. The concepts (state, phases,
> streaming) are unchanged — only where the code lives moved, so it can
> be unit tested and so `App.tsx` is left as pure rendering. See
> `USE_SYNC_EXTERNAL_STORE.md` for how the two are wired together.

## 1. The chat is a list of messages, and that list is state

The entire UI is a rendering of one array:

```ts
type Message = { id: string; role: "user" | "bot"; text: string };
const [messages, setMessages] = useState<Message[]>([]);
```

Every bubble on screen is a `.map()` over this array. There is no DOM
manipulation, no manually appending a `<div>` — you change the array,
React re-renders the list. This is *the* core idea to internalize:
**in React, UI is a function of state.** You don't tell the browser
"add a message to the screen," you tell React "here is the new list of
messages," and it figures out the DOM diff.

Why does this have to be state (not, say, a plain array variable)?
Because state is what React watches for changes to decide when to
re-render. A plain `let messages = []` array mutated in place would
never trigger a re-render — the component wouldn't know to look again.

## 2. A conversation is a state machine, not just a list

Beyond the messages themselves, the UI has to track *what phase* the
conversation is in, because that changes what's interactive and what's
displayed:

```ts
type BotPhase = "idle" | "thinking" | "streaming";
```

- **idle** — waiting on the user. Input is enabled.
- **thinking** — the user has sent a message, no reply text exists yet.
  This is the "..." / spinner / pulsing-dots state you've seen in every
  chat product. It exists because real inference takes time before the
  first token comes back, and a UI with no feedback during that gap
  feels broken or frozen.
- **streaming** — reply text is actively being revealed. Input is
  disabled during this window in most real products (you can't send a
  second message while the first is still arriving) — that's a design
  decision, not a technical requirement, and this project makes it
  explicit via `disabled={botPhase !== "idle"}`.

This finite set of named phases is a **state machine**: exactly one
phase is active at a time, and specific events move you between them
(send → thinking, timer fires → streaming, stream ends → idle). Naming
the phases explicitly (rather than inferring "are we thinking?" from
some combination of booleans) is what keeps the component's behavior
predictable as you add features later — related concept: [[streaming]].

## 3. What "streaming" actually is

<a name="streaming"></a>
When you watch ChatGPT or Claude "type" a response, that is **not** a
CSS animation and it is **not** the client waiting for the full answer
then fake-typing it out. It's real: the server computes the answer one
token (roughly, one word-ish chunk) at a time, and sends each token to
the browser the instant it's ready, usually over a persistent HTTP
connection using **Server-Sent Events (SSE)** or a chunked fetch
response. The client appends each token to the message as it arrives.

This project fakes that arrival process with `setTimeout`, but the
*shape* of the client-side logic is the same one you'd write against a
real streaming API:

```ts
function streamWords(id, words, index) {
  // 1. render everything received so far
  setMessages(prev => prev.map(m =>
    m.id === id ? { ...m, text: words.slice(0, index).join(" ") } : m
  ));
  // 2. if there's more coming, wait, then handle the next chunk
  if (index < words.length) {
    setTimeout(() => streamWords(id, words, index + 1), delay());
  } else {
    // 3. no more chunks — mark this message done
  }
}
```

A real implementation swaps step 2's `setTimeout` for an SSE
`onmessage` handler or a `ReadableStream` reader loop — "wait for the
next chunk, append it, repeat until the server signals completion" —
but the state shape (a message that is "still arriving" vs "done") is
identical. That's why this message type has a `streaming?: boolean`
flag — real code needs the same flag, to know when to stop showing a
cursor / stop disabling input / persist the final message.

## 4. Where the blinking cursor comes from

The `▌`-style cursor at the end of a streaming message
(`.cursor` in `index.css`) is pure CSS: a thin element with a
`border-left`, shown only while `message.streaming` is true. It's a
convention borrowed from terminal UIs to signal "more is coming,"
not something the browser or React gives you for free — you render it
conditionally exactly like any other piece of state-driven UI.

## 5. "Thinking" vs "streaming" — two different waits, two different signals

It's worth being precise about why real chat UIs almost always show
*two* distinct waiting states instead of one generic spinner:

- **Thinking** covers unpredictable server-side latency (routing,
  retrieval, reasoning) before any output exists. There's nothing to
  show yet, so the UI shows an indeterminate signal (dots, pulse,
  "thinking…").
- **Streaming** covers output that exists and is arriving progressively.
  The UI shows the *real, partial* content — not a placeholder — because
  showing actual words is both more informative and feels faster than
  an indeterminate spinner, even if the total time is the same.

Conflating these into one "loading" boolean is the single most common
simplification that makes a chat UI feel worse than it needs to.

## 6. Layout with (almost) no styling

`src/index.css` intentionally has two sections and nothing else:

1. **A reset** — zero out `margin`/`padding`, `box-sizing: border-box`,
   strip list bullets, make inputs/buttons inherit fonts. This isn't
   "styling," it's removing the browser's opinionated defaults so your
   layout math is predictable (no surprise 40px `<ul>` padding, etc.).
2. **Layout-only rules** — `display: flex`, `flex-direction`,
   `gap`, `overflow-y: auto`, `align-self`. No `color`, no `font-family`,
   no `border-radius`, no `box-shadow`, no `background`. The one
   exception is a plain `1px solid` border to separate the composer
   from the message list, and a border on the cursor — both are
   *structural* (they mark a boundary), not decorative.

What this proves: a chat UI's core *legibility* — who said what, in
what order, what's scrollable, what's pinned to the bottom — is a
layout problem, solvable with flexbox alone, *before any color exists*.
Sender was originally communicated purely by `align-self: flex-start`
vs `flex-end`; bubble backgrounds (`.message__text`,
`.message--user`/`.message--bot`) were added afterward, once that
structure already worked without them. That's the point of doing it in
this order: color/radius/avatars are additive polish on a layout that's
already correct, not something the layout depends on to make sense —
try it yourself by commenting out the `background` declarations, the
conversation is still perfectly readable.

Key CSS mechanism worth studying on its own: `flex-direction: column`
on `.messages` plus `flex: 1 1 auto` plus `overflow-y: auto` on the
scrolling region, inside a parent (`.chat`) that's `height: 100vh` — this
is *the* standard recipe for "header/scrollable-middle/footer" layouts
(chat apps, IDE panels, mobile apps), not something specific to chat.

## 7. Why messages need stable, unique `id`s

Each message gets an incrementing id (`makeId()`), used as the React
`key` in the `.map()`. Without a stable key, React can't tell "this is
the same message, just re-rendered with more text" apart from "this is
a new message" — it would either re-mount the DOM node on every
streamed word (breaking things like cursor position or animation) or
misattribute updates to the wrong bubble if messages are reordered or
removed later (e.g. deleting/regenerating a reply, which every real
chat product supports).

## 8. Where this project is a deliberate simplification

To keep the concepts visible, this mock skips things a production chat
UI would need:

- **Persistence** — messages live only in React state; refresh and
  they're gone. A real app persists to a backend or `localStorage`.
- **Error / retry states** — real network calls fail; there'd be a
  fourth phase (`error`) and a retry affordance.
- **Markdown / code rendering** — real assistant replies are often
  Markdown (code blocks, lists) parsed and rendered, not raw text.
- **Abort** — real UIs let you stop generation mid-stream (an
  `AbortController` closing the SSE connection); this mock's
  `setTimeout` chain has no cancel button, only unmount cleanup.

Each of those is a natural "next feature" once the fundamentals above
feel solid. Accessibility, listed here in an earlier version of this
doc, has since been addressed — see §9 below.

## 9. Accessibility

A chat UI has two accessibility problems ordinary pages don't: content
that appears *without a page navigation* (so assistive tech needs to be
told about it explicitly), and content that arrives *progressively*
(so naive "announce every change" wiring becomes a screen reader
reading one word at a time — worse than saying nothing).

- **One clean announcement per turn, not one per word.** `App.tsx`
  derives a single `liveText` string from `messages`/`botPhase`, sent
  through a visually-hidden `role="status" aria-live="polite"` element.
  It updates exactly twice per turn: once with "Bot is thinking", once
  with the complete reply text after streaming finishes. The *visible*
  message list is not itself a live region — sighted users still see
  words arrive progressively, but assistive tech only ever hears
  finished thoughts. This is why the visible "thinking…" placeholder
  bubble is marked `aria-hidden="true"`: its announcement is the status
  region's job, not its own.
- **A real `<label>`, not just a placeholder.** Placeholder text
  disappears on input and isn't reliably announced by every screen
  reader — it's a hint, not a name. The composer input has a proper
  (visually-hidden) `<label htmlFor>` giving it a stable accessible
  name, via the `.sr-only` utility class (clips content visually while
  leaving it in the accessibility tree — different from `display: none`,
  which removes it from both).
- **Focus follows the conversation.** Setting `disabled` on the input
  during "thinking"/"streaming" causes the browser to force-blur it — so
  without intervention, a keyboard user finishes a turn with focus
  sitting on `<body>`. An effect watches for the busy→idle transition
  and calls `.focus()` on the input, so the next message can be typed
  immediately without hunting for the field. See the earlier discussion
  of this exact behavior for the tradeoff (auto-focus is a deliberate
  choice, reasonable here because the input is the page's one primary
  control).
- **Visible focus, explicitly.** `:focus-visible { outline: 2px solid; }`
  in `index.css` guarantees a clear focus indicator (WCAG 2.4.7) instead
  of trusting each browser's default, which varies in visibility.
- **Touch target size.** `.composer__input`/`.composer__send` get a
  `min-height: 44px` — the WCAG 2.5.5 minimum — via layout properties,
  not decoration.
- **Typography as legibility, not decoration.** `body` now sets
  `font-family: system-ui, …` and `line-height: 1.5`. Both are framed
  as accessibility (WCAG 1.4.8 recommends ≥1.5 line-height for body
  text; an unset `font-family` falls back to a serif default that's
  harder to read on screen at small sizes), not visual styling — no
  color, weight, or size changed.

What was deliberately *not* done: the visible message list was **not**
given `role="log"`/`aria-live` directly. ARIA's `role="log"` implies an
*implicit* `aria-live="polite"`, which some screen readers honor — that
would mean every streamed-word DOM mutation gets announced on top of
the explicit status region, double-announcing (and reintroducing the
word-by-word chatter the status region exists to avoid). Keeping the
visible list as plain, non-live content and routing all announcements
through one explicit, deliberately-throttled status element is more
predictable across screen readers than relying on implicit ARIA
semantics.
