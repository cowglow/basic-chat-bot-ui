import {
  randomReply as defaultRandomReply,
  randomThinkingDelay as defaultRandomThinkingDelay,
  randomWordDelay as defaultRandomWordDelay,
} from "../mockBot";

export type Role = "user" | "bot";

export type Message = {
  id: string;
  role: Role;
  text: string;
  /** true while this bot message is still being revealed word by word */
  streaming?: boolean;
};

/** idle: waiting for input. thinking: delay before any text appears.
 * streaming: words are being appended to the last bot message. */
export type BotPhase = "idle" | "thinking" | "streaming";

export type ChatSnapshot = {
  messages: Message[];
  botPhase: BotPhase;
};

type Listener = () => void;

export type ChatStoreDeps = {
  randomReply: () => string;
  randomThinkingDelay: () => number;
  randomWordDelay: () => number;
};

const defaultDeps: ChatStoreDeps = {
  randomReply: defaultRandomReply,
  randomThinkingDelay: defaultRandomThinkingDelay,
  randomWordDelay: defaultRandomWordDelay,
};

/**
 * Owns the conversation's messages, phase, and timers. Deliberately has
 * no import from "react" — it can be created and driven with plain
 * function calls, which is what makes it unit-testable without
 * rendering anything. See useChat.ts for the (thin) React binding, and
 * USE_SYNC_EXTERNAL_STORE.md for why subscribe/getSnapshot look the way
 * they do.
 */
export class ChatStore {
  private deps: ChatStoreDeps;
  private messages: Message[] = [];
  private botPhase: BotPhase = "idle";
  private snapshot: ChatSnapshot;
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private nextId = 0;

  constructor(deps: ChatStoreDeps = defaultDeps) {
    this.deps = deps;
    this.snapshot = { messages: this.messages, botPhase: this.botPhase };
  }

  /** Registers a listener called after every state change; returns the
   * unsubscribe function. This exact shape — `(cb) => () => void` — is
   * what useSyncExternalStore requires from its "subscribe" argument. */
  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Returns the current state. Must stay cheap and synchronous, and
   * must return the SAME object reference when nothing has changed —
   * React uses Object.is on this return value to decide whether to
   * re-render. */
  getSnapshot = (): ChatSnapshot => this.snapshot;

  sendMessage = (rawText: string): void => {
    const text = rawText.trim();
    if (!text || this.botPhase !== "idle") return;

    this.commit({
      messages: [...this.messages, this.makeMessage("user", text)],
      botPhase: "thinking",
    });

    this.timer = setTimeout(() => {
      this.startStreaming();
    }, this.deps.randomThinkingDelay());
  };

  /** Cancels any pending timer and drops all listeners. Call this from
   * the consumer's cleanup (e.g. a useEffect return) once the store is
   * no longer needed. */
  destroy = (): void => {
    if (this.timer !== null) clearTimeout(this.timer);
    this.listeners.clear();
  };

  private startStreaming(): void {
    const botMessage = this.makeMessage("bot", "", true);
    this.commit({
      messages: [...this.messages, botMessage],
      botPhase: "streaming",
    });

    const words = this.deps.randomReply().split(" ");
    this.revealWord(botMessage.id, words, 1);
  }

  private revealWord(botId: string, words: string[], count: number): void {
    this.commit({
      messages: this.messages.map((m) =>
        m.id === botId ? { ...m, text: words.slice(0, count).join(" ") } : m
      ),
    });

    if (count < words.length) {
      this.timer = setTimeout(
        () => this.revealWord(botId, words, count + 1),
        this.deps.randomWordDelay()
      );
      return;
    }

    this.commit({
      messages: this.messages.map((m) =>
        m.id === botId ? { ...m, streaming: false } : m
      ),
      botPhase: "idle",
    });
  }

  private makeMessage(role: Role, text: string, streaming?: boolean): Message {
    this.nextId += 1;
    return { id: String(this.nextId), role, text, streaming };
  }

  /** The only place state is written: replaces the snapshot object (so
   * getSnapshot's reference actually changes) and notifies listeners. */
  private commit(next: Partial<ChatSnapshot>): void {
    this.messages = next.messages ?? this.messages;
    this.botPhase = next.botPhase ?? this.botPhase;
    this.snapshot = { messages: this.messages, botPhase: this.botPhase };
    this.listeners.forEach((listener) => listener());
  }
}
