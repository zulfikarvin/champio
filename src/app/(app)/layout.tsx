import Link from "next/link";
import { redirect } from "next/navigation";
import { signOutAction } from "@/app/(auth)/actions";
import { CreateTeamForm } from "@/app/(app)/create-team-form";
import { MobileNav, SidebarNav } from "@/app/(app)/nav";
import { TeamSwitcher } from "@/app/(app)/team-switcher";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getT } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import { getActiveTeam, listMemberships } from "@/lib/teams";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const t = await getT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already redirects signed-out users; this is the real guard, since
  // middleware can be bypassed by a mis-scoped matcher.
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, is_admin")
    .eq("id", user.id)
    .single();

  const memberships = await listMemberships();

  // Onboarding: a user with no team has nothing the app shell could show them.
  if (memberships.length === 0) {
    return (
      <main className="relative flex min-h-svh items-center justify-center px-5 py-12">
        <div className="absolute right-5 top-5">
          <LanguageSwitcher />
        </div>

        <div className="card w-full max-w-sm p-6 sm:p-8">
          <h1 className="display-lg mb-1 text-primary">{t("team.setup")}</h1>
          <p className="mb-6 text-sm text-ink-muted">{t("team.setupSub")}</p>
          <CreateTeamForm />
          <form action={signOutAction} className="mt-4">
            <Button type="submit" variant="ghost" size="sm" className="w-full">
              {t("nav.signOut")}
            </Button>
          </form>
        </div>
      </main>
    );
  }

  const activeTeam = await getActiveTeam();
  const isAdmin = profile?.is_admin ?? false;

  return (
    <div className="flex min-h-svh flex-col lg:flex-row">
      <aside className="hidden w-64 shrink-0 border-r border-hairline bg-surface px-4 py-6 lg:flex lg:flex-col">
        <div className="mb-6 flex items-center justify-between gap-2 px-3">
          <Link href="/dashboard" className="text-xl font-extrabold text-primary">
            {t("app.name")}
          </Link>
          <LanguageSwitcher />
        </div>

        {activeTeam ? (
          <div className="mb-6">
            <TeamSwitcher
              memberships={memberships}
              activeTeamId={activeTeam.teamId}
            />
          </div>
        ) : null}

        <SidebarNav isAdmin={isAdmin} />

        <div className="mt-auto border-t border-hairline pt-4">
          <p className="truncate px-3 text-sm font-semibold text-ink">
            {profile?.full_name ?? user.email}
          </p>
          <p className="truncate px-3 text-xs text-ink-muted">{user.email}</p>
          <form action={signOutAction} className="mt-2">
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="w-full justify-start"
            >
              {t("nav.signOut")}
            </Button>
          </form>
        </div>
      </aside>

      {/* Mobile header: brand + team switcher, since the sidebar is gone below lg. */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-hairline bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/dashboard" className="text-lg font-extrabold text-primary">
          {t("app.name")}
        </Link>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          {activeTeam ? (
            <div className="min-w-0 max-w-[9rem]">
              <TeamSwitcher
                memberships={memberships}
                activeTeamId={activeTeam.teamId}
              />
            </div>
          ) : null}
          <LanguageSwitcher />
        </div>
      </header>

      {/* pb-20 clears the fixed mobile tab bar. */}
      <main className="flex-1 px-4 pb-20 pt-6 sm:px-6 lg:px-10 lg:pb-10">
        {children}
      </main>

      <MobileNav isAdmin={isAdmin} />
    </div>
  );
}
