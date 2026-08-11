import type { Metadata } from "next";
import { PhasePlaceholder } from "@/components/ui/phase-placeholder";

export const metadata: Metadata = { title: "Reference Library" };

export default function LibraryPage() {
  return (
    <PhasePlaceholder
      title="Reference Library"
      phase={5}
      description="Winning papers and decks, filterable by track, year and competition, served from private storage via signed URLs. Ships with Phase 5."
    />
  );
}
