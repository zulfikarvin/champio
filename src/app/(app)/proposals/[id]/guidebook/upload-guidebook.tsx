"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ScrollText } from "lucide-react";
import { toast } from "sonner";
import { attachGuidebookAction } from "@/app/(app)/proposals/guidebook-actions";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { createBrowserSupabase } from "@/lib/supabase/browser";

/**
 * Uploads this competition's guidebook — drag a PDF onto the zone, or click to
 * browse.
 *
 * Same pattern as the version upload: browser → Supabase Storage directly, so a
 * large PDF never has to fit inside a serverless request body, and the bucket's
 * team-prefix policy is what authorises the write. The server action afterwards
 * records metadata and queues compilation.
 *
 * File validation lives in FileDropzone; everything below assumes a PDF within
 * the size limit has already arrived.
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
  const [uploading, setUploading] = useState(false);
  const [, startTransition] = useTransition();

  async function handleFile(file: File) {
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
    }
  }

  return (
    <FileDropzone
      accept="application/pdf"
      extensions={[".pdf"]}
      maxBytes={MAX_BYTES}
      onFile={handleFile}
      busy={uploading}
      busyLabel="Uploading…"
      label="Drop the guidebook here"
      hint="PDF, up to 25MB — or click to browse"
      wrongTypeMessage="Guidebooks must be PDF."
      icon={<ScrollText className="size-5" />}
    />
  );
}
