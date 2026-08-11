import "server-only";

import { extractText, getDocumentProxy } from "unpdf";

/**
 * PDF text extraction.
 *
 * `unpdf` is a serverless-targeted build of pdf.js: no native bindings, no
 * filesystem access, which is what makes it viable inside a Vercel function.
 *
 * Text is emitted with explicit page markers because the whole value of the
 * diagnostic is feedback that says *where* — "restate the thesis on page 2", not
 * "restate the thesis". The model can only cite a location if the location is in
 * the text it was given.
 */

export type ExtractedDocument = {
  /** Full text with `[page N]` markers between pages. */
  text: string;
  meta: ExtractedMeta;
};

export type ExtractedMeta = {
  page_count: number;
  /** Present for decks; equals page_count for PDFs, set properly for PPTX in Phase 3. */
  slide_count: number | null;
  word_count: number;
  /** Pages that produced no text — usually scans. Surfaced to the user, because
   *  a 12-page scan silently evaluated as 3 pages of text is a bad diagnosis. */
  empty_pages: number[];
};

/** A document with almost no text is likely a scan; below this we refuse. */
const MIN_USABLE_WORDS = 50;

export class ExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractionError";
  }
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

/** Collapses the ragged whitespace pdf.js produces without joining words. */
function normalisePageText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractPdf(buffer: ArrayBuffer): Promise<ExtractedDocument> {
  let pages: string[];
  let pageCount: number;

  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    pageCount = pdf.numPages;

    // mergePages: false gives one string per page, which is what page markers need.
    const result = await extractText(pdf, { mergePages: false });
    pages = result.text;
  } catch (cause) {
    throw new ExtractionError(
      `Could not read the PDF. It may be corrupt or password-protected. (${
        cause instanceof Error ? cause.message : String(cause)
      })`,
    );
  }

  const emptyPages: number[] = [];
  const sections: string[] = [];

  pages.forEach((page, index) => {
    const pageNumber = index + 1;
    const text = normalisePageText(page ?? "");

    if (text.length === 0) emptyPages.push(pageNumber);
    sections.push(`[page ${pageNumber}]\n${text}`);
  });

  const text = sections.join("\n\n");
  const wordCount = countWords(pages.join(" "));

  if (wordCount < MIN_USABLE_WORDS) {
    throw new ExtractionError(
      `Only ${wordCount} words could be extracted from ${pageCount} page(s). ` +
        `If this is a scanned document, export a text-based PDF and upload again.`,
    );
  }

  return {
    text,
    meta: {
      page_count: pageCount,
      slide_count: pageCount,
      word_count: wordCount,
      empty_pages: emptyPages,
    },
  };
}
