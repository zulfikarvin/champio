import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NewProposalForm } from "@/app/(app)/proposals/new-proposal-form";
import { listTracksWithRubrics } from "@/lib/proposals";

export const metadata: Metadata = { title: "New competition" };

export default async function NewProposalPage() {
  const tracks = await listTracksWithRubrics();

  return (
    <div className="mx-auto w-full max-w-xl">
      <Link
        href="/proposals"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted transition-colors hover:text-accent"
      >
        <ArrowLeft className="size-4" />
        Competitions
      </Link>

      <h1 className="display-lg mb-1 text-primary">New competition</h1>
      <p className="mb-8 text-sm text-ink-muted">
        Pick the format you are competing in. Once it exists you can upload the
        guidebook and your draft versions.
      </p>

      <div className="card p-6">
        {tracks.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No tracks found — run migration 0004 to seed them.
          </p>
        ) : (
          <NewProposalForm tracks={tracks} />
        )}
      </div>
    </div>
  );
}
