import { useEffect, useRef, useState } from "react";
import { useChat } from "./chat/useChat";

export default function App() {
  const { messages, botPhase, sendMessage } = useChat();
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wasBusyRef = useRef(false);

  // Auto-scroll to the newest message whenever the list changes, or while
  // a bot reply is still streaming words in.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  // Disabling the input during "thinking"/"streaming" force-blurs it (browsers
  // blur elements when they become disabled). Return focus to it once the bot
  // finishes, so keyboard/screen-reader users aren't left having to hunt for
  // it before typing the next message. Only fires on the busy -> idle edge,
  // not on the initial mount (autoFocus already covers that).
  useEffect(() => {
    if (botPhase !== "idle") {
      wasBusyRef.current = true;
    } else if (wasBusyRef.current) {
      wasBusyRef.current = false;
      inputRef.current?.focus();
    }
  }, [botPhase]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    sendMessage(draft);
    setDraft("");
  }

  // A single, complete announcement per bot turn for assistive tech: once
  // when the bot starts thinking, once with the full reply when it's done.
  // Deliberately NOT wired to fire on every streamed word — a screen reader
  // reading out one word at a time as it arrives is a well-known bad
  // experience, not a good one. Sighted users still see the words arrive
  // progressively in the (non-live) message list below.
  const lastMessage = messages[messages.length - 1];
  const liveText =
    botPhase === "thinking"
      ? "Bot is thinking"
      : lastMessage?.role === "bot" && !lastMessage.streaming
        ? lastMessage.text
        : "";

  return (
    <main className="chat">
      <div className="messages" aria-label="Conversation">
        {messages.map((m) => (
          <div key={m.id} className={`message message--${m.role}`}>
            <span className="message__sender">
              {m.role === "user" ? "You" : "Bot"}
            </span>
            <p className="message__text">
              {m.text}
              {m.streaming && <span className="cursor" aria-hidden="true" />}
            </p>
          </div>
        ))}

        {botPhase === "thinking" && (
          <div className="message message--bot" aria-hidden="true">
            <span className="message__sender">Bot</span>
            <p className="message__text message__text--thinking">
              thinking…
            </p>
          </div>
        )}

        <div ref={endRef} />
      </div>

      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {liveText}
      </div>

      <form className="composer" onSubmit={handleSubmit}>
        <label htmlFor="composer-input" className="sr-only">
          Message
        </label>
        <input
          id="composer-input"
          ref={inputRef}
          className="composer__input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message"
          disabled={botPhase !== "idle"}
          autoFocus
        />
        <button
          className="composer__send"
          type="submit"
          disabled={botPhase !== "idle" || draft.trim() === ""}
        >
          Send
        </button>
      </form>
    </main>
  );
}
