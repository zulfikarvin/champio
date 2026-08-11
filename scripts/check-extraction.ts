/**
 * Verifies PDF extraction against a real file.
 *
 *   npx tsx scripts/check-extraction.ts <path-to.pdf>
 *
 * Prints the page markers, counts, and the first lines of each page, so you can
 * see exactly what the model will be given. Worth running against a real
 * competition deck before trusting a report that cites "slide 7" — if extraction
 * loses the page boundaries, every location the model cites is wrong.
 */

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

// The extraction module imports `server-only`, which throws outside a React
// server environment. That guard is correct — it keeps pdf.js out of the client
// bundle — so rather than weaken it, we satisfy it with an empty module here.
// Must run before the dynamic import below, hence the deferred import.
const nodeRequire = createRequire(import.meta.url);
nodeRequire.cache[nodeRequire.resolve("server-only")] = {
  id: "server-only",
  filename: "server-only",
  loaded: true,
  exports: {},
} as unknown as NodeModule;

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: npx tsx scripts/check-extraction.ts <file.pdf>");
    process.exit(1);
  }

  const { extractPdf } = await import("../src/lib/extraction/pdf");

  const buffer = await readFile(path);
  const { text, meta } = await extractPdf(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  );

  console.log("\nMetadata");
  console.log(`  pages       ${meta.page_count}`);
  console.log(`  words       ${meta.word_count}`);
  console.log(
    `  empty pages ${meta.empty_pages.length === 0 ? "none" : meta.empty_pages.join(", ")}`,
  );

  const markers = [...text.matchAll(/\[page (\d+)\]/g)].map((m) => Number(m[1]));
  console.log(`  markers     ${markers.length} (${markers.join(", ")})`);

  const contiguous = markers.every((n, i) => n === i + 1);
  console.log(`  contiguous  ${contiguous ? "yes" : "NO — page numbering is wrong"}`);

  console.log("\nFirst line of each page");
  for (const section of text.split(/\n\n(?=\[page )/)) {
    const [marker, ...rest] = section.split("\n");
    const preview = rest.join(" ").slice(0, 90);
    console.log(`  ${marker.padEnd(10)} ${preview || "(no text)"}`);
  }

  console.log(`\n${text.length} characters total\n`);

  if (!contiguous || markers.length !== meta.page_count) {
    console.error("Extraction is not sound — page markers do not match page count.");
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error("\nExtraction failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
