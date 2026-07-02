import { useEffect, useRef, useState } from "react";
import { html as readmeHtml } from "../README.md";

// Self-contained: owns its own open state, the "Read me" trigger button, and
// the <dialog> that shows the README (pre-compiled to HTML at build time by
// vite-plugin-markdown — see vite.config.ts — so no markdown parser ships to
// the client). App.tsx just renders <ReadmeButton /> wherever the link
// should appear; no dialog state to manage from the outside.
export default function ReadmeButton() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Native <dialog> is controlled imperatively (showModal()/close()), so we
  // sync it to the declarative `open` state here. The "close" event (fired
  // by Esc, or by the backdrop-click handler below calling .close()) is what
  // keeps `open` in sync when the dialog closes some way other than our own
  // close button.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) setOpen(false);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Read me
      </button>
      <dialog
        ref={dialogRef}
        className="readme-dialog"
        aria-labelledby="readme-dialog-title"
        onClose={() => setOpen(false)}
        onClick={handleBackdropClick}
      >
        <div className="readme-dialog__header">
          <h2 id="readme-dialog-title">README</h2>
          <button type="button" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
        <div
          className="readme-dialog__body"
          // Content is this repo's own README.md, not user input.
          dangerouslySetInnerHTML={{ __html: readmeHtml }}
        />
      </dialog>
    </>
  );
}
