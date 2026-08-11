import { cn } from "@/lib/cn";

/**
 * The Business Model Canvas, laid out in its standard spatial arrangement.
 *
 * Built as a CSS grid rather than an image or inline SVG for two reasons: the
 * block text has to reflow and stay legible at 390px, which a fixed-viewBox SVG
 * cannot do; and a grid stays selectable and readable by a screen reader, which a
 * flattened diagram would not.
 *
 * The numbers are the *fill order* taught in the module — customer first, money
 * last — not the reading order. That is deliberate: the diagram is there to make
 * the "fill it in this order" section concrete, not to decorate the page.
 */

type Block = {
  /** Fill order taught in the module, 1–9. */
  step: number;
  title: string;
  prompt: string;
  /** Desktop grid placement. Mobile stacks in DOM order. */
  area: string;
  tone: "customer" | "infrastructure" | "money";
};

const BLOCKS: Block[] = [
  {
    step: 8,
    title: "Key Partners",
    prompt: "Who do we need?",
    area: "partners",
    tone: "infrastructure",
  },
  {
    step: 6,
    title: "Key Activities",
    prompt: "What must we do?",
    area: "activities",
    tone: "infrastructure",
  },
  {
    step: 7,
    title: "Key Resources",
    prompt: "What do we need?",
    area: "resources",
    tone: "infrastructure",
  },
  {
    step: 2,
    title: "Value Propositions",
    prompt: "Why us?",
    area: "value",
    tone: "customer",
  },
  {
    step: 4,
    title: "Customer Relationships",
    prompt: "How do we keep them?",
    area: "relationships",
    tone: "customer",
  },
  {
    step: 3,
    title: "Channels",
    prompt: "How does it reach them?",
    area: "channels",
    tone: "customer",
  },
  {
    step: 1,
    title: "Customer Segments",
    prompt: "For whom?",
    area: "segments",
    tone: "customer",
  },
  {
    step: 9,
    title: "Cost Structure",
    prompt: "Where does money go?",
    area: "cost",
    tone: "money",
  },
  {
    step: 5,
    title: "Revenue Streams",
    prompt: "Where does money come from?",
    area: "revenue",
    tone: "money",
  },
];

const TONE_STYLES: Record<Block["tone"], string> = {
  infrastructure: "bg-violet-100 border-violet-200",
  customer: "bg-violet-200/50 border-violet-300",
  money: "bg-primary text-white border-primary-dark",
};

const STEP_STYLES: Record<Block["tone"], string> = {
  infrastructure: "bg-secondary text-white",
  customer: "bg-accent text-white",
  money: "bg-white text-primary",
};

export function BusinessModelCanvas() {
  return (
    <figure className="not-prose my-8">
      <div
        className={cn(
          "grid gap-2",
          // Mobile: one column, stacked in fill order.
          "grid-cols-1",
          // Desktop: the canonical nine-box arrangement.
          "sm:[grid-template-areas:'partners_activities_value_relationships_segments''partners_resources_value_channels_segments''cost_cost_cost_revenue_revenue']",
          "sm:grid-cols-5 sm:grid-rows-[1fr_1fr_auto]",
        )}
      >
        {BLOCKS.map((block) => (
          <div
            key={block.title}
            style={{ gridArea: block.area }}
            className={cn(
              "flex flex-col rounded-[12px] border p-3",
              TONE_STYLES[block.tone],
            )}
          >
            <span
              className={cn(
                "mb-1.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                STEP_STYLES[block.tone],
              )}
              aria-hidden
            >
              {block.step}
            </span>
            <span
              className={cn(
                "text-[13px] font-bold leading-tight",
                block.tone === "money" ? "text-white" : "text-primary",
              )}
            >
              {block.title}
            </span>
            <span
              className={cn(
                "mt-0.5 text-[11px] leading-snug",
                block.tone === "money" ? "text-violet-200" : "text-ink-muted",
              )}
            >
              {block.prompt}
            </span>
          </div>
        ))}
      </div>

      <figcaption className="mt-3 text-xs leading-relaxed text-ink-muted">
        The nine blocks in their standard positions. The numbers are the order to{" "}
        <strong className="font-semibold text-ink">fill</strong> them, not to read
        them — start with the customer, end with cost. The right-hand blocks are
        the customer; the left-hand blocks are the machine that serves them.
      </figcaption>
    </figure>
  );
}
