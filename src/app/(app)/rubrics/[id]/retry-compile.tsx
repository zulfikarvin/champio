"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { recompileAction } from "@/app/(app)/rubrics/actions";
import { Button } from "@/components/ui/button";

export function RetryCompile({ guidebookId }: { guidebookId: string }) {
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
          const result = await recompileAction(guidebookId);
          if (result.status === "error") toast.error(result.message);
          else {
            toast.success("Reading the guidebook again…");
            router.refresh();
          }
        });
      }}
    >
      <RotateCcw />
      {pending ? "Queueing…" : "Try again"}
    </Button>
  );
}
