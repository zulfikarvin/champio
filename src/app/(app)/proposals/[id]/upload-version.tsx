"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { recordVersionAction } from "@/app/(app)/proposals/actions";
import { Button } from "@/components/ui/button";
import { createBrowserSupabase } from "@/lib/supabase/browser";

/**
 * Uploads a new version.
 *
 * The file goes browser → Supabase Storage directly, never through the Next
 * server: that keeps us clear of the request body limit on Vercel (a 25MB deck
 * would not fit) and means the bucket's own team-prefix policy is what authorises
 * the write. The server action afterwards only records metadata and queues work.
 *
 * The version id is minted here so the storage key and the database row agree,
 * which is what lets us clean up the orphaned object if the insert fails.
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [, startTransition] = useTransition();

  async function handleFile(file: File) {
    if (file.type !== "application/pdf") {
      toast.error("PDF only for now. PPTX support lands in the next phase.");
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
        className="w-full sm:w-auto"
      >
        <Upload />
        {uploading ? "Uploading…" : "Upload new version"}
      </Button>
    </>
  );
}
