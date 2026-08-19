"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";

/**
 * A drop target that is also a button.
 *
 * Drag and drop is the fast path, not the only one: the element is a real
 * `<button>`, so it focuses and activates from the keyboard, and dragging is
 * impossible for anyone using one. Both routes end in the same `onFile`.
 *
 * Scoped rather than page-level on purpose. The competition page shows two
 * uploaders at once — the guidebook and a new version — and a drop anywhere on
 * the page would have to guess which one was meant.
 */

export type FileDropzoneProps = {
  /** MIME type the file must report, e.g. "application/pdf". */
  accept: string;
  /** Extensions for the file picker's filter, e.g. [".pdf"]. */
  extensions: string[];
  maxBytes: number;
  onFile: (file: File) => void | Promise<void>;
  busy?: boolean;
  /** Shown while `busy`. */
  busyLabel: string;
  label: string;
  hint: string;
  /** Wording differs per uploader — a guidebook and a draft fail differently. */
  wrongTypeMessage: string;
  icon: ReactNode;
  className?: string;
};

export function FileDropzone({
  accept,
  extensions,
  maxBytes,
  onFile,
  busy = false,
  busyLabel,
  label,
  hint,
  wrongTypeMessage,
  icon,
  className,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  /**
   * Depth counter, not a boolean.
   *
   * `dragleave` fires every time the pointer crosses into a *child* element, so
   * a boolean flickers off the moment the cursor reaches the icon or the label.
   * Counting enter/leave pairs means the highlight only clears when the pointer
   * has genuinely left the zone.
   */
  const dragDepth = useRef(0);

  /**
   * A file dropped outside a zone makes the browser navigate away from the page
   * and open it — losing whatever the user had typed. Suppressing the default
   * document-wide turns a near miss into nothing happening.
   */
  useEffect(() => {
    const swallow = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
    };
    window.addEventListener("dragover", swallow);
    window.addEventListener("drop", swallow);
    return () => {
      window.removeEventListener("dragover", swallow);
      window.removeEventListener("drop", swallow);
    };
  }, []);

  function validateAndSend(files: FileList | null) {
    const list = Array.from(files ?? []);
    if (list.length === 0) return;

    if (list.length > 1) {
      toast.error("One file at a time.");
      return;
    }

    const file = list[0];

    // A folder arrives as a zero-byte entry with no type; say something better
    // than "wrong file type" for it.
    if (file.type === "" && file.size === 0) {
      toast.error("That looks like a folder. Drop the PDF itself.");
      return;
    }
    if (file.type !== accept) {
      toast.error(wrongTypeMessage);
      return;
    }
    if (file.size > maxBytes) {
      const mb = (maxBytes / 1024 / 1024).toFixed(0);
      toast.error(
        `That file is ${(file.size / 1024 / 1024).toFixed(1)}MB — the limit is ${mb}MB.`,
      );
      return;
    }

    void onFile(file);
  }

  const carriesFiles = (event: React.DragEvent) =>
    event.dataTransfer.types.includes("Files");

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={[accept, ...extensions].join(",")}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          validateAndSend(event.target.files);
          // Cleared so choosing the same file twice in a row still fires change.
          event.target.value = "";
        }}
      />

      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          if (busy || !carriesFiles(event)) return;
          event.preventDefault();
          dragDepth.current += 1;
          setDragging(true);
        }}
        onDragOver={(event) => {
          if (busy || !carriesFiles(event)) return;
          // Without this the drop event never fires at all.
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={(event) => {
          if (busy) return;
          event.preventDefault();
          dragDepth.current -= 1;
          if (dragDepth.current <= 0) {
            dragDepth.current = 0;
            setDragging(false);
          }
        }}
        onDrop={(event) => {
          if (busy) return;
          event.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          validateAndSend(event.dataTransfer.files);
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-[16px]",
          "border-2 border-dashed px-6 py-7 text-center transition-colors",
          dragging
            ? "border-accent bg-violet-100"
            : "border-hairline bg-surface hover:border-accent-light hover:bg-violet-100/40",
          busy && "cursor-wait opacity-60",
          className,
        )}
      >
        <span
          className={cn(
            "inline-flex size-10 items-center justify-center rounded-[12px] transition-colors",
            dragging ? "bg-accent text-white" : "bg-violet-100 text-accent",
          )}
        >
          {icon}
        </span>

        <span className="text-sm font-semibold text-primary">
          {busy ? busyLabel : dragging ? "Drop to upload" : label}
        </span>

        {!busy ? (
          <span className="text-xs text-ink-muted">{hint}</span>
        ) : null}
      </button>
    </>
  );
}
