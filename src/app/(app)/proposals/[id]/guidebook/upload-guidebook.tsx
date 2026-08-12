"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { attachGuidebookAction } from "@/app/(app)/proposals/guidebook-actions";
import { Button } from "@/components/ui/button";
import { createBrowserSupabase } from "@/lib/supabase/browser";

/**
 * Uploads this competition's guidebook.
 *
 * Same pattern as the proposal upload: browser → Supabase Storage directly, so a
 * large PDF never has to fit inside a serverless request body, and the bucket's
 * team-prefix policy is what authorises the write. The server action afterwards
 * records metadata and queues compilation.
 */

const MAX_BYTES = 25 * 1024 * 1024;

export function UploadGuidebook({
  proposalId,
  teamId,
}: {
  proposalId: string;
  teamId: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [, startTransition] = useTransition();

  async function handleFile(file: File) {
    if (file.type !== "application/pdf") {
      toast.error("Guidebooks must be PDF.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(
        `That file is ${(file.size / 1024 / 1024).toFixed(1)}MB — the limit is 25MB.`,
      );
      return;
    }

    setUploading(true);
    const supabase = createBrowserSupabase();
    const guidebookId = crypto.randomUUID();
    const filePath = `${teamId}/${guidebookId}.pdf`;

    try {
      const { error: uploadError } = await supabase.storage
        .from("guidebooks")
        .upload(filePath, file, { contentType: "application/pdf", upsert: false });

      if (uploadError) {
        toast.error(`Upload failed: ${uploadError.message}`);
        return;
      }

      const result = await attachGuidebookAction({
        proposalId,
        guidebookId,
        filePath,
        fileName: file.name,
      });

      if (result.status === "error") {
        // The row was not created, so the object is an orphan inside the team's
        // storage quota. Remove it rather than leave a file nothing points at.
        await supabase.storage.from("guidebooks").remove([filePath]);
        toast.error(result.message);
        return;
      }

      toast.success("Uploaded. Reading the guidebook…");
      startTransition(() => router.refresh());
    } catch (cause) {
      toast.error(
        `Upload failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <Button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        <Upload />
        {uploading ? "Uploading…" : "Upload guidebook"}
      </Button>
    </>
  );
}
