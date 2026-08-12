import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Target } from "lucide-react";
import { isDiagramBlock, renderDiagram } from "@/components/diagrams";
import { getModule } from "@/lib/learning";

export const metadata: Metadata = { title: "Article" };

export default async function ModulePage({
  params,
}: PageProps<"/tracks/[slug]/[order]">) {
  const { slug, order } = await params;

  const orderIndex = Number(order);
  if (!Number.isInteger(orderIndex) || orderIndex < 1) notFound();

  const lesson = await getModule(slug, orderIndex);
  if (!lesson) notFound();

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Link
        href={`/tracks/${slug}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted transition-colors hover:text-accent"
      >
        <ArrowLeft className="size-4" />
        {lesson.trackName}
      </Link>

      <header className="mb-8">
        <p className="text-sm font-semibold text-accent">
          Article {lesson.orderIndex}
        </p>
        <h1 className="display-lg mt-1 text-primary">{lesson.title}</h1>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" />
            {lesson.estMinutes} min read
          </span>
          {lesson.quizPassed ? (
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
              <CheckCircle2 className="size-3.5" />
              Quiz passed
            </span>
          ) : null}
          {lesson.isDraft ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 font-bold text-amber-700">
              DRAFT
            </span>
          ) : null}
        </div>
      </header>

      {/* `prose` comes from @tailwindcss/typography. The overrides align it with
          the brand tokens — table styling matters here because several articles
          teach through comparison tables. */}
      <article
        className="prose prose-sm max-w-none
          prose-headings:font-bold prose-headings:text-primary
          prose-h2:mt-10 prose-h2:mb-3 prose-h2:text-xl
          prose-h3:mt-6 prose-h3:mb-2 prose-h3:text-base
          prose-p:leading-relaxed prose-p:text-ink
          prose-li:text-ink prose-li:leading-relaxed
          prose-strong:font-semibold prose-strong:text-primary
          prose-a:text-accent
          prose-blockquote:border-l-accent prose-blockquote:bg-violet-100/50
          prose-blockquote:not-italic prose-blockquote:py-1 prose-blockquote:px-4
          prose-blockquote:rounded-r-[12px] prose-blockquote:text-secondary-dark
          prose-code:text-secondary prose-code:before:content-none prose-code:after:content-none
          prose-pre:bg-primary-dark prose-pre:text-violet-200 prose-pre:rounded-[16px]
          prose-table:text-sm prose-th:text-primary
          prose-hr:border-hairline
          sm:prose-base"
      >
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            /* A ```diagram fenced block is swapped for a registered component.
               Everything else renders as a normal code block. */
            code({ className, children, ...props }) {
              if (isDiagramBlock(className)) {
                return renderDiagram(String(children));
              }
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            },
            /* Tables can be wider than a 390px screen. Scrolling the table inside
               its own container keeps the page body from scrolling sideways. */
            table({ children, ...props }) {
              return (
                <div className="not-prose my-6 overflow-x-auto">
                  <table
                    className="w-full min-w-[32rem] border-collapse text-sm"
                    {...props}
                  >
                    {children}
                  </table>
                </div>
              );
            },
            th({ children, ...props }) {
              return (
                <th
                  className="border-b border-hairline bg-violet-100/60 px-3 py-2 text-left font-bold text-primary"
                  {...props}
                >
                  {children}
                </th>
              );
            },
            td({ children, ...props }) {
              return (
                <td
                  className="border-b border-hairline px-3 py-2 align-top text-ink"
                  {...props}
                >
                  {children}
                </td>
              );
            },
          }}
        >
          {lesson.contentMd}
        </Markdown>
      </article>

      {/* Optional self-check, offered rather than imposed. */}
      {lesson.hasQuiz ? (
        <Link
          href={`/tracks/${slug}/quizzes/${lesson.orderIndex}`}
          className="mt-10 flex items-center gap-4 rounded-[16px] bg-violet-100 p-5 transition-colors hover:bg-violet-200/60"
        >
          <Target className="size-5 shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-primary">
              {lesson.quizPassed ? "Retake this quiz" : "Test yourself on this"}
            </p>
            <p className="mt-0.5 text-sm text-secondary-dark">
              A few questions on what you just read.
            </p>
          </div>
          <ArrowRight className="size-4 shrink-0 text-accent" />
        </Link>
      ) : null}

      <nav className="mt-10 flex items-center justify-between gap-4 border-t border-hairline pt-6">
        {lesson.previousOrderIndex ? (
          <Link
            href={`/tracks/${slug}/${lesson.previousOrderIndex}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted transition-colors hover:text-accent"
          >
            <ArrowLeft className="size-4" />
            Previous
          </Link>
        ) : (
          <span />
        )}

        {lesson.nextOrderIndex ? (
          <Link
            href={`/tracks/${slug}/${lesson.nextOrderIndex}`}
            className="inline-flex min-w-0 items-center gap-1.5 text-right text-sm font-semibold text-accent hover:underline"
          >
            <span className="truncate">{lesson.nextTitle}</span>
            <ArrowRight className="size-4 shrink-0" />
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
