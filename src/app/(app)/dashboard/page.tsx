import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, FileText, Sparkles } from "lucide-react";
import { getLocale, getT } from "@/lib/i18n-server";
import { listTracks } from "@/lib/learning";
import { createClient } from "@/lib/supabase/server";
import { getActiveTeam } from "@/lib/teams";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const activeTeam = await getActiveTeam();
  const supabase = await createClient();

  // listTracks() rather than a raw tracks query: it already folds in the caller's
  // quiz attempts, so these cards show real progress instead of a static blurb.
  const [{ count: proposalCount }, tracks] = await Promise.all([
    supabase
      .from("proposals")
      .select("id", { count: "exact", head: true })
      .eq("team_id", activeTeam?.teamId ?? ""),
    listTracks(locale),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-8">
        <p className="text-sm font-semibold text-accent">
          {activeTeam?.teamName}
        </p>
        <h1 className="display-lg mt-1 text-primary">{t("dash.workspace")}</h1>
        <p className="mt-2 text-sm text-ink-muted">
          {t("dash.proposalsInProgress", { count: proposalCount ?? 0 })}
        </p>
      </header>

      <section className="mb-10 grid gap-4 sm:grid-cols-2">
        <Link
          href="/proposals"
          className="card group flex flex-col p-6 transition-shadow hover:shadow-[0_12px_24px_-10px_rgba(16,0,43,0.12)]"
        >
          <FileText className="mb-3 size-6 text-accent" />
          <h2 className="text-lg font-bold text-primary">{t("dash.diagnose")}</h2>
          <p className="mt-1 text-sm text-ink-muted">{t("dash.diagnoseSub")}</p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent">
            {t("dash.openProposals")}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>

        <Link
          href="/tracks"
          className="card group flex flex-col p-6 transition-shadow hover:shadow-[0_12px_24px_-10px_rgba(16,0,43,0.12)]"
        >
          <BookOpen className="mb-3 size-6 text-accent" />
          <h2 className="text-lg font-bold text-primary">{t("dash.buildSkills")}</h2>
          <p className="mt-1 text-sm text-ink-muted">{t("dash.buildSkillsSub")}</p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent">
            {t("dash.openTracks")}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-primary">{t("dash.yourTracks")}</h2>
          <Link
            href="/tracks"
            className="text-sm font-semibold text-accent hover:underline"
          >
            {t("dash.viewAll")}
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {tracks.map((track) => {
            const done =
              track.quizCount > 0 && track.passedCount === track.quizCount;

            return (
              <Link
                key={track.id}
                href={`/tracks/${track.slug}`}
                className="card group flex flex-col p-5 transition-shadow hover:shadow-[0_12px_24px_-10px_rgba(16,0,43,0.12)]"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  {done ? (
                    <CheckCircle2 className="size-5 text-emerald-600" />
                  ) : (
                    <Sparkles className="size-5 text-violet-300" />
                  )}
                  {track.quizCount > 0 ? (
                    <span className="text-xs font-semibold text-ink-muted">
                      {track.passedCount}/{track.quizCount}
                    </span>
                  ) : null}
                </div>

                <h3 className="font-bold text-primary">{track.name}</h3>
                <p className="mt-1 flex-1 text-sm leading-relaxed text-ink-muted">
                  {track.description}
                </p>

                {track.moduleCount === 0 ? (
                  <span className="mt-4 text-xs font-semibold text-ink-muted">
                    {t("tracks.comingSoon")}
                  </span>
                ) : (
                  <>
                    <div
                      className="mt-4 h-1.5 overflow-hidden rounded-full bg-canvas"
                      role="img"
                      aria-label={`${track.progressPercent}% complete`}
                    >
                      <div
                        className="h-full rounded-full bg-accent transition-all"
                        style={{ width: `${track.progressPercent}%` }}
                      />
                    </div>
                    <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent">
                      {track.passedCount > 0
                        ? t("tracks.continue")
                        : t("tracks.open")}
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </>
                )}
              </Link>
            );
          })}

          {tracks.length === 0 ? (
            <p className="text-sm text-ink-muted">
              No tracks yet — run migration 0004 to seed them.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
