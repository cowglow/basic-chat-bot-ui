# `useSyncExternalStore`: a dev's guide

This project's chat logic lives in `src/chat/ChatStore.ts`, a plain
TypeScript class with **no import from `"react"`**. The only React code
in the whole feature is six lines in `src/chat/useChat.ts`, built around
one hook: `useSyncExternalStore`. This doc explains what that hook does,
why it exists, and how to use it correctly — using this project's real
code as the example throughout.

## 1. The problem it solves

`useState` manages state that React itself owns and creates. But
sometimes the state you want to render doesn't live in React at all —
it lives in:

- a plain class instance (this project's `ChatStore`)
- the browser (`window.innerWidth`, `navigator.onLine`)
- a third-party store (Redux, Zustand, a WebSocket connection)

That state can change for reasons React doesn't know about — a
`setTimeout` firing, a `resize` event, a message arriving on a socket.
Something has to tell React "hey, go re-render, the external thing
changed." Before this hook existed, people wired this up by hand with
`useState` + `useEffect(() => external.subscribe(() => setSomething({})), [])`
— a fake state update just to force a re-render. That pattern has a
subtle bug under React's concurrent rendering: it can "tear" — showing
different parts of the UI computed from different versions of the
external state during the same render.

`useSyncExternalStore` is React's built-in, correct way to do this. It
guarantees every component reading from the same external store sees
the same value in the same render, even under concurrent features.

**Rule of thumb:** if the state fits comfortably in `useState` /
`useReducer` inside one component, use that — it's simpler. Reach for
`useSyncExternalStore` only when the state's true owner is something
that exists independent of any one component instance, like this
project's `ChatStore`.

## 2. The contract: three functions, one snapshot

```ts
const snapshot = useSyncExternalStore(subscribe, getSnapshot);
```

| Argument | Type | Job |
|---|---|---|
| `subscribe` | `(onStoreChange: () => void) => (() => void)` | Register a callback the store will call after every change. Return a function that undoes the registration. |
| `getSnapshot` | `() => Snapshot` | Return the *current* value. Must be synchronous, side-effect-free, and callable any number of times. |
| *(optional)* `getServerSnapshot` | `() => Snapshot` | Same as above, but for the server-rendered pass. This project has no SSR, so it's omitted. |

In `src/chat/ChatStore.ts`, these map directly onto two class fields:

```ts
subscribe = (listener: Listener): (() => void) => {
  this.listeners.add(listener);
  return () => { this.listeners.delete(listener); };
};

getSnapshot = (): ChatSnapshot => this.snapshot;
```

And in `src/chat/useChat.ts`, they're passed straight through:

```ts
const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
```

That's the entire wiring. No `useState`, no `useEffect` calling
`setState` — React handles "did the snapshot change, and if so,
re-render" internally.

## 3. The data flow, step by step

Walk through what happens when a user sends a message, tracing through
`ChatStore.ts` and `useChat.ts`:

1. **Mount.** `useChat()` runs. It creates one `ChatStore` instance
   (cached in a `useRef` so it survives re-renders — see §5) and calls
   `useSyncExternalStore(store.subscribe, store.getSnapshot)`.
2. **First read.** Internally, `useSyncExternalStore` calls
   `store.getSnapshot()` to get the initial value —
   `{ messages: [], botPhase: "idle" }` — and renders `App` with it.
3. **Subscribe.** After committing this render, React calls
   `store.subscribe(onStoreChange)`, where `onStoreChange` is a function
   *React itself defines* (not something you write). It's stashed inside
   `ChatStore`'s `listeners` set. This is the callback the store will
   call to say "something happened, go check again."
4. **User types and hits send.** `App`'s `handleSubmit` calls
   `sendMessage(draft)`, which is really `store.sendMessage` — a method
   on the *store*, not a React setter.
5. **The store mutates itself and calls `commit`:**
   ```ts
   private commit(next: Partial<ChatSnapshot>): void {
     this.messages = next.messages ?? this.messages;
     this.botPhase = next.botPhase ?? this.botPhase;
     this.snapshot = { messages: this.messages, botPhase: this.botPhase }; // new object!
     this.listeners.forEach((listener) => listener());
   }
   ```
   Two things happen here that matter: a **new** `snapshot` object is
   created (the old one is left untouched), and every registered
   listener — including React's `onStoreChange` from step 3 — is called.
6. **React re-checks, not re-renders (yet).** `onStoreChange` doesn't
   force a re-render directly. It schedules React to call
   `store.getSnapshot()` again and compare the result to the snapshot
   it rendered last time, using `Object.is`.
7. **Compare.** Because `commit` replaced `this.snapshot` with a new
   object, `Object.is(oldSnapshot, newSnapshot)` is `false` — they're
   different objects. React proceeds to re-render `App` with the new
   snapshot.
8. **Repeat.** Every subsequent `commit()` call (bot message added →
   "thinking" → "streaming", each word revealed, final "idle") goes
   through exactly this same subscribe → commit → compare → re-render
   loop, driven by the `setTimeout` chain inside `ChatStore`, entirely
   independent of anything React-specific.
9. **Unmount.** `useChat`'s `useEffect` cleanup calls `store.destroy()`,
   which clears the pending timer and empties the `listeners` set. React
   also calls the unsubscribe function returned back in step 3, removing
   `onStoreChange` from that set (redundant here since `destroy` already
   cleared it, but this is what makes the pattern safe in general: the
   *store* doesn't need to know how many components are subscribed, or
   when — subscribe/unsubscribe manages that for it).

```
 render          →  getSnapshot() ──────────┐
   │                                        │ same reference? skip re-render
   │ (after commit)                         │ different reference? re-render
   ▼                                        │
 subscribe(cb) ←──── store keeps `cb` in a Set
   │
   ▼
 store.sendMessage() / internal setTimeout
   │
   ▼
 commit(): mutate state, replace snapshot object, call every `cb`
   │
   ▼
 React calls getSnapshot() again → compares → re-renders if changed
```

## 4. The rule that will bite you if you skip it: snapshot stability

`getSnapshot` **must** return the same object reference across calls
*unless the state actually changed*. If it builds a new object every
single time it's called — even when nothing changed — React sees a
"different" value on every check, concludes something changed, and
re-renders. That re-render calls `getSnapshot` again, which returns yet
another new object, so React re-renders again. **Infinite loop.**

This is why `ChatStore` never does this:

```ts
// DON'T: a new object literal on every call
getSnapshot = (): ChatSnapshot => ({
  messages: this.messages,
  botPhase: this.botPhase,
});
```

and instead caches the snapshot as a field, only replacing it inside
`commit()` when something real changed:

```ts
getSnapshot = (): ChatSnapshot => this.snapshot;
```

`ChatStore.test.ts` has a test that asserts exactly this property,
because it's the single most important invariant of the whole pattern:

```ts
it("returns the same snapshot reference when nothing has changed", () => {
  const first = store.getSnapshot();
  const second = store.getSnapshot();
  expect(first).toBe(second); // must be true — required by useSyncExternalStore

  store.sendMessage("hello");
  const third = store.getSnapshot();
  expect(third).not.toBe(second); // must be false — state did change
});
```

If you ever wrap some other external source with this hook and see an
"infinite loop / Maximum update depth exceeded" error, check this first:
is `getSnapshot` allocating a new object every call?

## 5. Creating the store instance exactly once

```ts
const [store] = useState(() => new ChatStore());
```

We need exactly one `ChatStore` per mounted `App`, created once, and
never replaced for the life of the component. Passing `useState` a
*function* (`() => new ChatStore()`) — its "lazy initializer" form —
runs that function only on the very first render; every re-render after
that, `useState` hands back the same instance and ignores the
initializer entirely. We destructure only the value, never the setter,
because this instance is never meant to change.

You'll sometimes see this same "create once" goal reached with
`useRef` instead:

```ts
// an alternative — works, but reads .current during render
const storeRef = useRef<ChatStore | null>(null);
if (storeRef.current === null) {
  storeRef.current = new ChatStore();
}
const store = storeRef.current;
```

Both are correct and both appear in React's own documentation. The
`useState` form is what this project uses because current versions of
`eslint-plugin-react-hooks` (rule `react-hooks/refs`) flag *any* read of
`ref.current` during render — including this lazy-init guard — since
reading a ref during render is unsafe in general (its value isn't
guaranteed consistent across the multiple render attempts React's
concurrent features can trigger before a commit). This particular usage
happens to be safe (the ref is frozen after the first render), but the
lint rule can't distinguish "safe, frozen-after-init" from "unsafe,
mutated-during-render" reads — so it flags both. `useState`'s lazy
initializer reaches the same result without ever touching `.current`,
so there's nothing for that rule to flag. The general lesson: prefer
`useState(() => …)` over a `useRef` null-check when the only thing you
need is "build this value once and never change it."

## 6. Why this makes testing trivial

Because `ChatStore` never imports `"react"`, `ChatStore.test.ts` tests
it with zero rendering, zero `render()`/`act()`/`renderHook()` — just
plain method calls and `vitest`'s fake timers:

```ts
const store = new ChatStore({
  randomReply: () => "alpha beta gamma",
  randomThinkingDelay: () => 1000,
  randomWordDelay: () => 100,
});

store.sendMessage("hello");
vi.advanceTimersByTime(1000);
expect(store.getSnapshot().botPhase).toBe("streaming");
```

This is the payoff of pulling the logic out of the component and out
of a hook: the *behavior* (thinking → streaming → idle, ignoring input
while busy, cleaning up timers) is tested directly against the thing
that implements it, with no React test utilities involved at all. The
hook (`useChat.ts`) is left so small — create, subscribe, clean up —
that it doesn't need its own tests; there's barely any logic in it to
get wrong.

## 7. Checklist for using `useSyncExternalStore` on your own store

- [ ] Does this state truly live outside a single component (a class,
      a browser API, a shared connection)? If not, use `useState`.
- [ ] Does `getSnapshot()` return a cached reference, only replaced when
      state actually changes?
- [ ] Does `subscribe(cb)` return an unsubscribe function that actually
      removes `cb`?
- [ ] Is `getSnapshot()` synchronous and free of side effects (no
      fetching, no mutating state, just reading)?
- [ ] Is there a cleanup path (e.g. a `destroy()` method, called from a
      `useEffect` return) so timers/connections don't leak when the
      component unmounts?

If you can check all five, you're using the hook the way it's meant to
be used.
