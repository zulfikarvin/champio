import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/db";

/**
 * First-party telemetry.
 *
 * Written through the service role, never from the client, because `events` has
 * no INSERT policy: if a browser could write here it could forge user_id,
 * team_id and event_name, and the /admin dashboard would be reporting fiction.
 *
 * The event name is a closed union rather than a string so that a typo becomes a
 * type error instead of a metric that silently reads zero forever.
 */
export const EVENT_NAMES = [
  "signup",
  "team_created",
  "team_switched",
  "module_completed",
  "quiz_passed",
  "proposal_created",
  "version_uploaded",
  "evaluation_completed",
  "guidebook_compiled",
  "delta_viewed",
  "result_reported",
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

type LogEventArgs = {
  name: EventName;
  userId?: string | null;
  teamId?: string | null;
  properties?: Record<string, Json>;
};

/**
 * Records an event. Deliberately never throws: telemetry is not worth failing a
 * user's action over. A failure is logged to the server console so it shows up
 * in Vercel logs rather than vanishing.
 */
export async function logEvent({
  name,
  userId = null,
  teamId = null,
  properties = {},
}: LogEventArgs): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("events").insert({
      event_name: name,
      user_id: userId,
      team_id: teamId,
      properties_json: properties,
    });

    if (error) {
      console.error(`[events] failed to record "${name}":`, error.message);
    }
  } catch (cause) {
    console.error(`[events] failed to record "${name}":`, cause);
  }
}
