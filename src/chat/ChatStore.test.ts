import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatStore } from "./ChatStore";

// Deterministic replacements for the real random helpers, so tests
// assert on exact text and can advance fake timers by exact amounts.
function makeTestStore() {
  return new ChatStore({
    randomReply: () => "alpha beta gamma",
    randomThinkingDelay: () => 1000,
    randomWordDelay: () => 100,
  });
}

describe("ChatStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts idle with no messages", () => {
    const store = makeTestStore();
    expect(store.getSnapshot()).toEqual({ messages: [], botPhase: "idle" });
  });

  it("adds the user message immediately and moves to 'thinking'", () => {
    const store = makeTestStore();
    store.sendMessage("hello");

    const snapshot = store.getSnapshot();
    expect(snapshot.botPhase).toBe("thinking");
    expect(snapshot.messages).toEqual([
      { id: "1", role: "user", text: "hello" },
    ]);
  });

  it("ignores blank input, and input sent while not idle", () => {
    const store = makeTestStore();
    store.sendMessage("   ");
    expect(store.getSnapshot().messages).toHaveLength(0);

    store.sendMessage("hello");
    store.sendMessage("are you still there?"); // dropped: phase is "thinking"
    expect(store.getSnapshot().messages).toHaveLength(1);
  });

  it("streams the bot reply one word at a time after the thinking delay", () => {
    const store = makeTestStore();
    store.sendMessage("hello");

    vi.advanceTimersByTime(1000); // thinking delay elapses
    let snapshot = store.getSnapshot();
    expect(snapshot.botPhase).toBe("streaming");
    expect(snapshot.messages[1]).toMatchObject({
      role: "bot",
      text: "alpha",
      streaming: true,
    });

    vi.advanceTimersByTime(100); // one word-reveal delay
    expect(store.getSnapshot().messages[1].text).toBe("alpha beta");

    vi.advanceTimersByTime(100); // final word
    snapshot = store.getSnapshot();
    expect(snapshot.messages[1]).toMatchObject({
      text: "alpha beta gamma",
      streaming: false,
    });
    expect(snapshot.botPhase).toBe("idle");
  });

  it("notifies subscribers on state changes, and stops after unsubscribing", () => {
    const store = makeTestStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.sendMessage("hello");
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    vi.advanceTimersByTime(10_000); // would otherwise trigger streaming updates
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("returns the same snapshot reference when nothing has changed", () => {
    // This is the property useSyncExternalStore relies on to know
    // whether to re-render: see USE_SYNC_EXTERNAL_STORE.md.
    const store = makeTestStore();
    const first = store.getSnapshot();
    const second = store.getSnapshot();
    expect(first).toBe(second);

    store.sendMessage("hello");
    const third = store.getSnapshot();
    expect(third).not.toBe(second);
  });

  it("cancels pending timers on destroy", () => {
    const store = makeTestStore();
    store.sendMessage("hello");
    store.destroy();

    vi.advanceTimersByTime(10_000);
    expect(store.getSnapshot().botPhase).toBe("thinking"); // frozen mid-flow
  });
});
