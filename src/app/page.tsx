import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  FileSearch,
  GitCompareArrows,
  ScrollText,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

const FEATURES = [
  {
    icon: FileSearch,
    title: "Rubric-aligned diagnostics",
    body: "Upload a proposal or deck and get scored, evidence-cited feedback against the criteria judges actually use — with fixes tied to specific slides.",
  },
  {
    icon: GitCompareArrows,
    title: "Track your score lift",
    body: "Every version is scored against the same rubric, so v1 → v2 → v3 shows exactly which issues you resolved and which you did not.",
  },
  {
    icon: ScrollText,
    title: "Your competition's rubric",
    body: "Upload the official guidebook. Champio compiles it into a scoring rubric you can review and edit, then evaluates against that.",
  },
  {
    icon: BookOpen,
    title: "Structured learning tracks",
    body: "Issue trees, market sizing, financial modelling, pitch delivery — unlocked module by module as you pass each quiz.",
  },
] as const;

const TRACKS = [
  {
    name: "Business Case",
    body: "Issue trees and MECE, market sizing, framework selection, GTM strategy, financial modelling, pitch delivery.",
  },
  {
    name: "Business Plan",
    body: "Market validation, business model design, unit economics, go-to-market, projections, and the funding ask.",
  },
  {
    name: "Academic Essay",
    body: "Thesis construction, research and evidence, argument architecture, academic register, and citation discipline.",
  },
] as const;

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-hairline bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <span className="text-xl font-extrabold text-primary">
            {t("app.name")}
          </span>
          <nav className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                {t("auth.signIn")}
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">Get started</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          {/* Soft brand wash behind the headline. aria-hidden: purely decorative. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-40 h-[36rem] bg-[radial-gradient(60%_50%_at_50%_50%,rgba(157,78,221,0.16),transparent_70%)]"
          />
          <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20">
            <span className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-4 py-1.5 text-xs font-semibold text-secondary">
              <Trophy className="size-3.5" />
              For Indonesian student competitors
            </span>

            <h1 className="display-xl mt-6 max-w-3xl text-primary">
              {t("app.tagline")}
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg">
              Champio turns competition preparation into a loop you can actually
              run: learn the frameworks, submit a draft, get scored feedback, and
              watch your score climb version over version.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className="sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto">
                  Start free
                  <ArrowRight />
                </Button>
              </Link>
              <Link href="/login" className="sm:w-auto">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  {t("auth.signIn")}
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
          <h2 className="display-lg max-w-2xl text-primary">
            Feedback specific enough to act on
          </h2>
          <p className="mt-3 max-w-xl text-ink-muted">
            Not &ldquo;strengthen your analysis&rdquo; — which slide, what to
            change, and what it is worth.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <article key={title} className="card p-6 sm:p-7">
                <span className="inline-flex size-11 items-center justify-center rounded-[14px] bg-violet-100">
                  <Icon className="size-5 text-accent" />
                </span>
                <h3 className="mt-4 text-lg font-bold text-primary">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  {body}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Tracks */}
        <section className="bg-primary-dark py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <h2 className="display-lg max-w-2xl text-white">
              Three tracks, built around how each format is judged
            </h2>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {TRACKS.map((track) => (
                <article
                  key={track.name}
                  className="rounded-[20px] border border-white/10 bg-white/5 p-6"
                >
                  <h3 className="text-lg font-bold text-white">{track.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-violet-200">
                    {track.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-5 py-16 text-center sm:px-8 sm:py-24">
          <h2 className="display-lg mx-auto max-w-2xl text-primary">
            Your next submission should score higher than your last
          </h2>
          <div className="mt-8 flex justify-center">
            <Link href="/signup">
              <Button size="lg">
                Create your team
                <ArrowRight />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-hairline py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span className="font-semibold text-primary">{t("app.name")}</span>
          <span>Built for Indonesian student competitors.</span>
        </div>
      </footer>
    </div>
  );
}
