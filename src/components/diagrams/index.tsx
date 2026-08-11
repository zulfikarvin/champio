import type { ReactNode } from "react";
import { BusinessModelCanvas } from "@/components/diagrams/business-model-canvas";

/**
 * Diagrams a learning module can embed from its markdown.
 *
 * Module content is plain markdown in the database, so it cannot contain
 * components — and enabling raw HTML in the renderer would mean any future
 * content editor could inject markup into the page. Instead a module writes a
 * fenced block naming a diagram:
 *
 * ```diagram
 * business-model-canvas
 * ```
 *
 * and the module reader swaps it for the component registered here. The markdown
 * stays valid and safe, and an unknown name degrades to a visible note rather
 * than breaking the page.
 */
const DIAGRAMS: Record<string, () => ReactNode> = {
  "business-model-canvas": BusinessModelCanvas,
};

export function renderDiagram(name: string): ReactNode {
  const Diagram = DIAGRAMS[name.trim()];

  if (!Diagram) {
    return (
      <p className="not-prose my-6 rounded-[12px] bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Unknown diagram: <code className="font-mono">{name.trim()}</code>
      </p>
    );
  }

  return <Diagram />;
}

export function isDiagramBlock(className: string | undefined): boolean {
  return className === "language-diagram";
}
