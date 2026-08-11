"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { reevaluateAction } from "@/app/(app)/proposals/actions";
import { Button } from "@/components/ui/button";

export function RetryButton({ versionId }: { versionId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await reevaluateAction(versionId);
          if (result.status === "error") toast.error(result.message);
          else {
            toast.success("Evaluation queued.");
            router.refresh();
          }
        });
      }}
    >
      <RotateCcw />
      {pending ? "Queueing…" : "Run again"}
    </Button>
  );
}
