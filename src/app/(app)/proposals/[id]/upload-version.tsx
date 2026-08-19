"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp } from "lucide-react";
import { toast } from "sonner";
import { recordVersionAction } from "@/app/(app)/proposals/actions";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { createBrowserSupabase } from "@/lib/supabase/browser";

/**
 * Uploads a new version — drag a PDF onto the zone, or click to browse.
 *
 * The file goes browser → Supabase Storage directly, never through the Next
 * server: that keeps us clear of the request body limit on Vercel (a 25MB deck
 * would not fit) and means the bucket's own team-prefix policy is what authorises
 * the write. The server action afterwards only records metadata and queues work.
 *
 * The version id is minted here so the storage key and the database row agree,
 * which is what lets us clean up the orphaned object if the insert fails.
 *
 * File validation lives in FileDropzone; everything below assumes a PDF within
 * the size limit has already arrived.
 */

const MAX_BYTES = 25 * 1024 * 1024;

export function UploadVersion({
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
    const versionId = crypto.randomUUID();
    const filePath = `${teamId}/${proposalId}/${versionId}.pdf`;

    try {
      const { error: uploadError } = await supabase.storage
        .from("proposals")
        .upload(filePath, file, { contentType: "application/pdf", upsert: false });

      if (uploadError) {
        toast.error(`Upload failed: ${uploadError.message}`);
        return;
      }

      const result = await recordVersionAction({
        proposalId,
        versionId,
        filePath,
        fileName: file.name,
      });

      if (result.status === "error") {
        // The row was not created, so the object is an orphan. Remove it rather
        // than leave a file nothing points at inside the team's quota.
        await supabase.storage.from("proposals").remove([filePath]);
        toast.error(result.message);
        return;
      }

      toast.success("Uploaded. Evaluation queued.");
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
      label="Drop your draft here"
      hint="PDF, up to 25MB — or click to browse"
      wrongTypeMessage="PDF only for now. PPTX support lands in the next phase."
      icon={<FileUp className="size-5" />}
    />
  );
}
