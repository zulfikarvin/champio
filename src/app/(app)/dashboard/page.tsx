import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, FileText, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getActiveTeam } from "@/lib/teams";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const activeTeam = await getActiveTeam();
  const supabase = await createClient();

  // RLS scopes both of these to the caller's teams, so no explicit team filter
  // is needed for correctness — the .eq() below is for the *active* team only.
  const [{ count: proposalCount }, { data: tracks }] = await Promise.all([
    supabase
      .from("proposals")
      .select("id", { count: "exact", head: true })
      .eq("team_id", activeTeam?.teamId ?? ""),
    supabase.from("tracks").select("id, slug, name, description").order("slug"),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-8">
        <p className="text-sm font-semibold text-accent">
          {activeTeam?.teamName}
        </p>
        <h1 className="display-lg mt-1 text-primary">Team workspace</h1>
        <p className="mt-2 text-sm text-ink-muted">
          {proposalCount ?? 0} proposal{proposalCount === 1 ? "" : "s"} in
          progress.
        </p>
      </header>

      <section className="mb-10 grid gap-4 sm:grid-cols-2">
        <Link
          href="/proposals"
          className="card group flex flex-col p-6 transition-shadow hover:shadow-[0_12px_24px_-10px_rgba(16,0,43,0.12)]"
        >
          <FileText className="mb-3 size-6 text-accent" />
          <h2 className="text-lg font-bold text-primary">Diagnose a proposal</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Upload a draft and get rubric-aligned, evidence-cited feedback.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent">
            Open proposals
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>

        <Link
          href="/tracks"
          className="card group flex flex-col p-6 transition-shadow hover:shadow-[0_12px_24px_-10px_rgba(16,0,43,0.12)]"
        >
          <BookOpen className="mb-3 size-6 text-accent" />
          <h2 className="text-lg font-bold text-primary">Build the skills</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Work through a track, one module and quiz at a time.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent">
            Open tracks
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-bold text-primary">Your tracks</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {(tracks ?? []).map((track) => (
            <article key={track.id} className="card p-5">
              <Sparkles className="mb-2 size-5 text-violet-300" />
              <h3 className="font-bold text-primary">{track.name}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                {track.description}
              </p>
            </article>
          ))}
          {(tracks ?? []).length === 0 ? (
            <p className="text-sm text-ink-muted">
              No tracks yet — run migration 0004 to seed them.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
