import type { Metadata } from "next";
import { PhasePlaceholder } from "@/components/ui/phase-placeholder";

export const metadata: Metadata = { title: "Learning Tracks" };

export default function TracksPage() {
  return (
    <PhasePlaceholder
      title="Learning Tracks"
      phase={5}
      description="The skill tree, module reader and quiz engine arrive in Phase 5. The three tracks and their default rubrics are already seeded by migration 0004."
    />
  );
}
