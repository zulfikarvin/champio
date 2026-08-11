"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import type { TeamFormState } from "@/app/(app)/team-state";
import { ACTIVE_TEAM_COOKIE } from "@/lib/constants";
import { logEvent } from "@/lib/events";
import { getCurrentUser } from "@/lib/supabase/server";
import { createTeam, listMemberships } from "@/lib/teams";

const createTeamSchema = z.object({
  name: z.string().trim().min(2, "Team name must be at least 2 characters.").max(120),
  university: z.string().trim().max(160).optional(),
});

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // a year; it is only a preference

export async function createTeamAction(
  _prev: TeamFormState,
  formData: FormData,
): Promise<TeamFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };

  const parsed = createTeamSchema.safeParse({
    name: formData.get("name"),
    university: formData.get("university") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  }

  let teamId: string;
  try {
    ({ teamId } = await createTeam({
      name: parsed.data.name,
      university: parsed.data.university ?? null,
      userId: user.id,
    }));
  } catch (cause) {
    console.error("[teams] createTeam failed:", cause);
    return { error: "Could not create the team. Try again." };
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_TEAM_COOKIE, teamId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  await logEvent({ name: "team_created", userId: user.id, teamId });

  revalidatePath("/", "layout");
  return { error: null };
}

/**
 * Switches the active team.
 *
 * Membership is re-checked here even though the cookie is validated on read and
 * RLS would refuse the data anyway. Cheap, and it keeps a stale cookie from
 * silently pointing at a team the user was removed from.
 */
export async function switchTeamAction(formData: FormData): Promise<void> {
  const teamId = formData.get("teamId");
  if (typeof teamId !== "string") return;

  const memberships = await listMemberships();
  if (!memberships.some((m) => m.teamId === teamId)) return;

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_TEAM_COOKIE, teamId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  const user = await getCurrentUser();
  await logEvent({ name: "team_switched", userId: user?.id ?? null, teamId });

  revalidatePath("/", "layout");
}
