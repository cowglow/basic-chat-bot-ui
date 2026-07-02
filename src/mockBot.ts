// A fake "AI" that never calls a network. It exists purely to drive the UI
// through the same states a real streaming chat completion would: an
// unpredictable pause ("thinking"), then text arriving incrementally
// ("streaming"), then done.

const SENTENCES = [
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
  "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
  "Duis aute irure dolor in reprehenderit in voluptate velit esse.",
  "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia.",
  "Nulla facilisi, vivamus sagittis lacus vel augue laoreet rutrum faucibus.",
  "Curabitur blandit tempus porttitor, cras mattis consectetur purus sit amet.",
  "Nullam quis risus eget urna mollis ornare vel eu leo.",
];

function randomInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min));
}

/** One to four random sentences, joined into a single reply. */
export function randomReply(): string {
  const count = randomInt(1, 5); // 1..4 inclusive
  const picks: string[] = [];
  for (let i = 0; i < count; i++) {
    picks.push(SENTENCES[randomInt(0, SENTENCES.length)]);
  }
  return picks.join(" ");
}

/** How long the bot "thinks" before it starts replying, in ms. */
export function randomThinkingDelay(): number {
  return randomInt(500, 1800);
}

/** How long to wait before revealing the next word, in ms. */
export function randomWordDelay(): number {
  return randomInt(25, 120);
}
