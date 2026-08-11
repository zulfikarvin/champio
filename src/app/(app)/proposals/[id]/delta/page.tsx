import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PhasePlaceholder } from "@/components/ui/phase-placeholder";

export const metadata: Metadata = { title: "Compare versions" };

export default async function DeltaPage({ params }: PageProps<"/proposals/[id]/delta">) {
  const { id } = await params;

  return (
    <div>
      <Link
        href={`/proposals/${id}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted transition-colors hover:text-accent"
      >
        <ArrowLeft className="size-4" />
        Back to proposal
      </Link>
      <PhasePlaceholder
        title="Compare versions"
        phase={3}
        description="Overall score change, per-criterion arrows, and the issues you resolved between versions. The data is already here — both evaluations are scored against the same pinned rubric, which is what makes the comparison meaningful. The screen itself lands in Phase 3."
      />
    </div>
  );
}
