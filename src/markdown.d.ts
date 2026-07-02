// vite-plugin-markdown (configured with Mode.HTML in vite.config.ts) turns
// a `.md` import into these named exports instead of the raw file contents.
declare module "*.md" {
  const attributes: Record<string, unknown>;
  const html: string;
  export { attributes, html };
}
