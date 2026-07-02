import { useEffect, useState, useSyncExternalStore } from "react";
import { ChatStore } from "./ChatStore";
import type { BotPhase, Message } from "./ChatStore";

export type UseChatResult = {
  messages: Message[];
  botPhase: BotPhase;
  sendMessage: (text: string) => void;
};

/**
 * The thin React binding for ChatStore. All conversation logic lives in
 * the store; this hook only (a) creates one store instance per
 * component and keeps it alive across re-renders, (b) subscribes to it
 * via useSyncExternalStore, and (c) tears it down on unmount.
 */
export function useChat(): UseChatResult {
  // useState's lazy initializer runs exactly once, on mount, giving a
  // stable instance across re-renders — the setter is intentionally
  // never called. (A useRef "if (ref.current === null)" guard achieves
  // the same thing, but reads .current during render, which the
  // react-hooks/refs lint rule flags; this sidesteps that.)
  const [store] = useState(() => new ChatStore());

  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);

  useEffect(() => {
    return () => store.destroy();
  }, [store]);

  return {
    messages: snapshot.messages,
    botPhase: snapshot.botPhase,
    sendMessage: store.sendMessage,
  };
}
