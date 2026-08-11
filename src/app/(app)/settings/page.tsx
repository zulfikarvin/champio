import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CreateTeamForm } from "@/app/(app)/create-team-form";
import { t } from "@/lib/i18n";
import { getActiveTeam, listTeamMembers } from "@/lib/teams";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const activeTeam = await getActiveTeam();
  if (!activeTeam) redirect("/dashboard");

  const members = await listTeamMembers(activeTeam.teamId);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="display-lg mb-8 text-primary">Settings</h1>

      <section className="card mb-6 p-6">
        <h2 className="text-lg font-bold text-primary">{activeTeam.teamName}</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {activeTeam.university ?? "No university set"}
        </p>

        <h3 className="mt-6 mb-3 text-sm font-semibold text-ink">
          {t("team.members")}
        </h3>
        <ul className="divide-y divide-hairline">
          {members.map((member) => {
            const profile = member.profiles as {
              full_name: string | null;
              email: string | null;
            } | null;
            return (
              <li
                key={member.user_id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {profile?.full_name ?? profile?.email ?? "Member"}
                  </p>
                  <p className="truncate text-xs text-ink-muted">
                    {profile?.email}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-secondary">
                  {member.role === "owner" ? t("team.owner") : t("team.member")}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card p-6">
        <h2 className="mb-1 text-lg font-bold text-primary">
          {t("team.create")}
        </h2>
        <p className="mb-5 text-sm text-ink-muted">
          Competing in more than one competition? Create a separate team and
          switch between them.
        </p>
        <CreateTeamForm />
      </section>
    </div>
  );
}
