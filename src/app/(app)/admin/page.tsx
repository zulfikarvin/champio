import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PhasePlaceholder } from "@/components/ui/phase-placeholder";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user?.id ?? "")
    .single();

  // notFound() rather than a redirect: a non-admin should not learn that /admin
  // exists. The events SELECT policy denies them the data regardless.
  if (!profile?.is_admin) notFound();

  return (
    <PhasePlaceholder
      title="Admin"
      phase={6}
      description="Weekly active teams, iteration rate, median v1→v2 score lift, pipeline latency and success rate, and cumulative LLM cost. The events table is already recording; the dashboard reads it in Phase 6."
    />
  );
}
