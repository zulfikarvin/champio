import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScoreBadge } from "@/components/report/score-badge";
import { listProposals } from "@/lib/proposals";

export const metadata: Metadata = { title: "Proposals" };

export default async function ProposalsPage() {
  const proposals = await listProposals();

  return (
    <div className="mx-auto w-full max-w-4xl">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display-lg text-primary">Competitions</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Each competition holds one guidebook and every version of your entry.
          </p>
        </div>
        <Link href="/proposals/new">
          <Button size="sm">
            <Plus />
            New competition
          </Button>
        </Link>
      </header>

      {proposals.length === 0 ? (
        <div className="card flex flex-col items-start gap-4 p-8">
          <span className="inline-flex size-12 items-center justify-center rounded-[16px] bg-violet-100">
            <FileText className="size-6 text-accent" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-primary">No competitions yet</h2>
            <p className="mt-1 max-w-md text-sm text-ink-muted">
              Add a competition, upload its guidebook so Champio scores against
              the real judging criteria, then upload your drafts version by
              version.
            </p>
          </div>
          <Link href="/proposals/new">
            <Button>
              <Plus />
              Add your first competition
            </Button>
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {proposals.map((proposal) => (
            <li key={proposal.id}>
              <Link
                href={`/proposals/${proposal.id}`}
                className="card flex items-center gap-4 p-5 transition-shadow hover:shadow-[0_12px_24px_-10px_rgba(16,0,43,0.12)]"
              >
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-bold text-primary">
                    {proposal.title}
                  </h2>
                  <p className="mt-1 truncate text-xs text-ink-muted">
                    {proposal.trackName} ·{" "}
                    {proposal.rubricIsDefault
                      ? "built-in rubric"
                      : proposal.rubricName}{" "}
                    ·{" "}
                    {proposal.versionCount === 0
                      ? "no versions"
                      : `${proposal.versionCount} version${proposal.versionCount === 1 ? "" : "s"}`}
                  </p>
                </div>
                <ScoreBadge score={proposal.latestScore} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
