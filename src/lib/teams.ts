import "server-only";

import { cookies } from "next/headers";
import { ACTIVE_TEAM_COOKIE } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { TeamRole } from "@/lib/db";

export type Membership = {
  teamId: string;
  teamName: string;
  university: string | null;
  role: TeamRole;
};

/**
 * Every team the current user belongs to.
 *
 * Read through the *user-scoped* client, so RLS is doing the filtering. We are
 * not passing a user id and trusting ourselves to remember the WHERE clause.
 */
export async function listMemberships(): Promise<Membership[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("team_members")
    .select("team_id, role, teams(name, university)")
    .order("created_at", { ascending: true });

  if (error) throw new Error(`failed to list memberships: ${error.message}`);

  return (data ?? []).flatMap((row) => {
    // teams is a to-one embed; skip rather than crash if the join came back empty.
    const team = row.teams as { name: string; university: string | null } | null;
    if (!team) return [];
    return [
      {
        teamId: row.team_id,
        teamName: team.name,
        university: team.university,
        role: row.role,
      },
    ];
  });
}

/**
 * The team the user is currently working in.
 *
 * The cookie is a *preference*, not an authorisation: it is validated against
 * actual membership on every read, and a cookie naming a team the user does not
 * belong to is ignored rather than honoured. Even if that check were missing, RLS
 * would still refuse the data — this just keeps the UI coherent.
 */
export async function getActiveTeam(): Promise<Membership | null> {
  const memberships = await listMemberships();
  if (memberships.length === 0) return null;

  const cookieStore = await cookies();
  const preferred = cookieStore.get(ACTIVE_TEAM_COOKIE)?.value;

  return memberships.find((m) => m.teamId === preferred) ?? memberships[0];
}

/**
 * Creates a team and its owner membership.
 *
 * Both writes go through the service role for one reason: `team_members` has no
 * client INSERT policy (migration 0002), because a client that can insert there
 * can join any team as owner. That means team creation *must* be server-mediated,
 * and it also lets us guarantee a team never exists without an owner.
 */
export async function createTeam(input: {
  name: string;
  university?: string | null;
  userId: string;
}): Promise<{ teamId: string }> {
  const admin = createAdminClient();

  const { data: team, error: teamError } = await admin
    .from("teams")
    .insert({ name: input.name, university: input.university ?? null })
    .select("id")
    .single();

  if (teamError || !team) {
    throw new Error(`failed to create team: ${teamError?.message ?? "no row"}`);
  }

  const { error: memberError } = await admin
    .from("team_members")
    .insert({ team_id: team.id, user_id: input.userId, role: "owner" });

  if (memberError) {
    // Compensating delete: a team with no owner is unreachable by anyone, since
    // every policy on it is is_team_member(). Better to unwind than to orphan.
    await admin.from("teams").delete().eq("id", team.id);
    throw new Error(`failed to assign team owner: ${memberError.message}`);
  }

  return { teamId: team.id };
}

/** Members of a team, for the settings screen. RLS restricts this to teams the
 *  caller belongs to, and profiles are visible via shares_team_with(). */
export async function listTeamMembers(teamId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("team_members")
    .select("user_id, role, created_at, profiles(full_name, email)")
    .eq("team_id", teamId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`failed to list team members: ${error.message}`);
  return data ?? [];
}
