import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, ArrowLeft, CheckCircle2 } from "lucide-react";
import { CompileProgress } from "@/app/(app)/rubrics/[id]/compile-progress";
import { RetryCompile } from "@/app/(app)/rubrics/[id]/retry-compile";
import { RubricEditor } from "@/app/(app)/rubrics/[id]/rubric-editor";
import { getGuidebook } from "@/lib/guidebooks";

export const metadata: Metadata = { title: "Compiled rubric" };

/** Recompilation runs in after(); same ceiling as the other pipelines. */
export const maxDuration = 60;

export default async function GuidebookPage({ params }: PageProps<"/rubrics/[id]">) {
  const { id } = await params;
  const guidebook = await getGuidebook(id);

  // Covers both "no such guidebook" and "not your team" — RLS filtered it either
  // way, and the client learns nothing extra from the distinction.
  if (!guidebook) notFound();

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Link
        href="/rubrics"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted transition-colors hover:text-accent"
      >
        <ArrowLeft className="size-4" />
        Rubrics
      </Link>

      <header className="mb-8">
        <h1 className="display-lg text-primary">
          {guidebook.fileName ?? "Guidebook"}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Uploaded{" "}
          {new Date(guidebook.createdAt).toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
      </header>

      {guidebook.status === "uploaded" || guidebook.status === "compiling" ? (
        <CompileProgress
          guidebookId={guidebook.id}
          initialStatus={guidebook.status}
        />
      ) : null}

      {guidebook.status === "failed" ? (
        <div className="card p-6">
          <p className="flex items-start gap-2 text-sm text-red-700">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{guidebook.error ?? "Compilation failed."}</span>
          </p>
          <p className="mt-3 text-sm text-ink-muted">
            If the guidebook is a scan rather than a text PDF, the criteria cannot
            be read from it. Export a text-based PDF and upload again.
          </p>
          <div className="mt-4">
            <RetryCompile guidebookId={guidebook.id} />
          </div>
        </div>
      ) : null}

      {guidebook.savedRubricId ? (
        <div className="card flex items-start gap-3 p-6">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
          <div>
            <p className="font-semibold text-primary">Rubric saved</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">
              It is available when you create a proposal. A rubric is frozen once
              an evaluation has used it — to compile a different one, upload the
              guidebook again.
            </p>
            <Link
              href="/proposals/new"
              className="mt-3 inline-block text-sm font-semibold text-accent hover:underline"
            >
              Create a proposal with it
            </Link>
          </div>
        </div>
      ) : null}

      {guidebook.draftError ? (
        <div className="card p-6">
          <p className="flex items-start gap-2 text-sm text-amber-800">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>
              The compiled draft did not satisfy the rubric contract:{" "}
              {guidebook.draftError}
            </span>
          </p>
          <div className="mt-4">
            <RetryCompile guidebookId={guidebook.id} />
          </div>
        </div>
      ) : null}

      {guidebook.draft && !guidebook.savedRubricId ? (
        <>
          <div className="mb-6 rounded-[16px] bg-violet-100/60 p-5">
            <h2 className="font-bold text-primary">Check this before saving</h2>
            <p className="mt-1 text-sm leading-relaxed text-secondary-dark">
              These criteria were read out of your guidebook by a language model.
              It gets weights and labels right most of the time, but this rubric
              becomes the yardstick for every score your team receives — so it is
              worth two minutes against the original document.
            </p>
          </div>

          <RubricEditor guidebookId={guidebook.id} draft={guidebook.draft} />
        </>
      ) : null}
    </div>
  );
}
