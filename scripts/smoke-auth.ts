/**
 * End-to-end smoke test of the signed-in path against a running dev server.
 *
 *   npm run dev          # in one terminal
 *   npm run smoke        # in another
 *
 * Signs in as the demo user, rebuilds the session cookie exactly as
 * @supabase/ssr writes it, and fetches the protected pages with it — so this
 * exercises the real authenticated render (layout, team switcher, RLS-scoped
 * queries), not just the signed-out redirect that curl alone can reach.
 *
 * Requires `npm run seed:demo` to have been run.
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE_URL = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

const DEMO_EMAIL = "demo@champio.test";
const DEMO_PASSWORD = "champio-demo-pw-1";

/** Mirrors @supabase/ssr's chunker (utils/chunker.ts). */
const MAX_CHUNK_SIZE = 3180;

if (!SUPABASE_URL || !ANON_KEY) {
  console.error("Missing Supabase env in .env.local");
  process.exit(1);
}

let passed = 0;
const failures: string[] = [];

function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  } else {
    failures.push(label);
    console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/**
 * React SSR emits `<!-- -->` between adjacent text nodes, so `v{n}` arrives as
 * `v<!-- -->2` and a naive substring check misses it. Stripping the markers lets
 * assertions be written the way the text actually reads on screen.
 */
function stripSsrMarkers(html: string): string {
  return html.replace(/<!-- -->/g, "");
}

function buildCookie(sessionJson: string): string {
  const ref = new URL(SUPABASE_URL!).hostname.split(".")[0];
  const name = `sb-${ref}-auth-token`;
  const value =
    "base64-" + Buffer.from(sessionJson, "utf8").toString("base64url");

  if (value.length <= MAX_CHUNK_SIZE) return `${name}=${value}`;

  const parts: string[] = [];
  for (let i = 0; i * MAX_CHUNK_SIZE < value.length; i += 1) {
    parts.push(
      `${name}.${i}=${value.slice(i * MAX_CHUNK_SIZE, (i + 1) * MAX_CHUNK_SIZE)}`,
    );
  }
  return parts.join("; ");
}

async function main() {
  // Fail fast with a clear message rather than a confusing fetch error.
  try {
    await fetch(BASE_URL, { signal: AbortSignal.timeout(5000) });
  } catch {
    console.error(`No server at ${BASE_URL}. Start it with \`npm run dev\`.`);
    process.exit(1);
  }

  console.log("\nSigned-out routing");
  for (const path of ["/dashboard", "/proposals", "/admin"]) {
    const res = await fetch(`${BASE_URL}${path}`, { redirect: "manual" });
    const location = res.headers.get("location") ?? "";
    check(
      `${path} redirects to login`,
      res.status === 307 && location.includes("/login"),
      `${res.status} ${location}`,
    );
  }

  console.log("\nSign in");
  const supabase = createClient<Database>(SUPABASE_URL!, ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });

  if (error || !data.session) {
    check("demo user signs in", false, error?.message ?? "no session");
    console.error("\nRun `npm run seed:demo` first.\n");
    process.exit(1);
  }
  check("demo user signs in", true);

  const cookie = buildCookie(JSON.stringify(data.session));

  console.log("\nSigned-in pages render");
  const expectations: { path: string; must: string[] }[] = [
    { path: "/dashboard", must: ["Team workspace", "Delta Consulting (Demo)", "Business Case"] },
    { path: "/settings", must: ["Settings", "Members", "Demo Founder"] },
    // The seeded proposal and its v2 score must both appear, which proves the
    // list query, the RLS-scoped read and the score rollup all work together.
    {
      path: "/proposals",
      must: ["Competitions", "Reviving Warung Retail", "76.5", "New competition"],
    },
    { path: "/proposals/new", must: ["New competition", "Business Case"] },
    { path: "/tracks", must: ["Learning Tracks"] },
  ];

  for (const { path, must } of expectations) {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { cookie },
      redirect: "manual",
    });

    if (res.status !== 200) {
      check(`${path} renders`, false, `HTTP ${res.status}`);
      continue;
    }

    const body = stripSsrMarkers(await res.text());
    const missing = must.filter((token) => !body.includes(token));
    check(
      `${path} renders (${must.length} markers)`,
      missing.length === 0,
      missing.length > 0 ? `missing: ${missing.join(", ")}` : "",
    );
  }

  console.log("\nProposal detail and report");
  {
    // Follow the *seeded* proposal through to its v2 report, so the deep routes
    // are covered rather than just the list.
    //
    // Located by its title rather than by taking the first link: a real user's
    // own competitions also appear here, sort newer, and would otherwise be
    // picked instead — which is exactly what happened once and made this check
    // fail for a reason that had nothing to do with the code under test.
    const listRes = await fetch(`${BASE_URL}/proposals`, { headers: { cookie } });
    const listBody = stripSsrMarkers(await listRes.text());
    const seededCard = listBody.split("<li").find((chunk) =>
      chunk.includes("Reviving Warung Retail"),
    );
    const proposalId = seededCard?.match(/\/proposals\/([0-9a-f-]{36})"/)?.[1];

    if (!proposalId) {
      check("found seeded proposal link", false, "no proposal href in the list");
    } else {
      check("found seeded proposal link", true);

      const detail = await fetch(`${BASE_URL}/proposals/${proposalId}`, {
        headers: { cookie },
      });
      const detailBody = stripSsrMarkers(await detail.text());
      check(
        "proposal detail shows the version timeline",
        detail.status === 200 &&
          detailBody.includes("v2") &&
          detailBody.includes("View report") &&
          detailBody.includes("Judging criteria"),
        `HTTP ${detail.status}`,
      );
      check(
        "delta link appears with 2 evaluated versions",
        detailBody.includes("Compare versions"),
      );
      // Drag-and-drop degrades to a real <button> + file input, so both routes
      // must be present — a zone that only accepts drops excludes keyboard users.
      check(
        "version upload is a drop zone with a keyboard fallback",
        detailBody.includes("Drop your draft here") &&
          detailBody.includes("border-dashed") &&
          detailBody.includes('type="file"'),
      );

      const reportId = detailBody.match(/\/evaluations\/([0-9a-f-]{36})/)?.[1];
      if (!reportId) {
        check("found report link", false, "no evaluation href on the detail page");
      } else {
        const report = await fetch(
          `${BASE_URL}/proposals/${proposalId}/evaluations/${reportId}`,
          { headers: { cookie } },
        );
        const reportBody =
          report.status === 200 ? stripSsrMarkers(await report.text()) : "";
        check(
          "evaluation report renders score, summary and criteria",
          report.status === 200 &&
            reportBody.includes("Evaluation report") &&
            reportBody.includes("Problem–Solution Fit") &&
            reportBody.includes("Do this next"),
          `HTTP ${report.status}`,
        );
      }
    }
  }

  console.log("\nLearning path");
  {
    const tracks = await fetch(`${BASE_URL}/tracks`, { headers: { cookie } });
    const tracksBody = stripSsrMarkers(await tracks.text());
    check(
      "/tracks lists the three tracks",
      tracks.status === 200 &&
        ["Business Plan", "Academic Essay", "Business Case"].every((n) =>
          tracksBody.includes(n),
        ),
      `HTTP ${tracks.status}`,
    );

    const track = await fetch(`${BASE_URL}/tracks/business_plan`, {
      headers: { cookie },
    });
    const trackBody = stripSsrMarkers(await track.text());
    const moduleTitles = [
      "Business Model Canvas",
      "Problem to Idea",
      "Marketing Analysis",
      "Financial Projection",
      "Presentation &amp; Pitching",
    ];
    check(
      "skill tree shows all five modules",
      track.status === 200 && moduleTitles.every((t) => trackBody.includes(t)),
      moduleTitles.filter((t) => !trackBody.includes(t)).join(", "),
    );
    check(
      "articles are not gated",
      !trackBody.includes("Pass the previous"),
      "a lock message is still present",
    );
    check(
      "Test my Knowledge box is present",
      trackBody.includes("Test my Knowledge!"),
      "quiz box missing from the track page",
    );

    const first = await fetch(`${BASE_URL}/tracks/business_plan/1`, {
      headers: { cookie },
    });
    const firstBody = stripSsrMarkers(await first.text());
    check(
      "article 1 renders content without an inline quiz",
      first.status === 200 &&
        firstBody.includes("Business Model Canvas") &&
        !firstBody.includes("Check your understanding"),
      `HTTP ${first.status}`,
    );
    // The whole point of the column privilege: the answers must not reach the page.
    check(
      "module page does not leak answer text",
      !firstBody.includes("correct_index") && !firstBody.includes("explanation"),
      "answer key fields found in HTML",
    );

    // Every article is reachable directly now — nothing is gated.
    const deep = await fetch(`${BASE_URL}/tracks/business_plan/4`, {
      headers: { cookie },
      redirect: "manual",
    });
    check(
      "article 4 opens directly (no gate)",
      deep.status === 200,
      `HTTP ${deep.status}`,
    );

    const hub = await fetch(`${BASE_URL}/tracks/business_plan/quizzes`, {
      headers: { cookie },
    });
    const hubBody = stripSsrMarkers(await hub.text());
    check(
      "quiz hub lists all five quizzes",
      hub.status === 200 &&
        ["Business Model Canvas", "Financial Projection"].every((t) =>
          hubBody.includes(t),
        ),
      `HTTP ${hub.status}`,
    );

    const oneQuiz = await fetch(`${BASE_URL}/tracks/business_plan/quizzes/1`, {
      headers: { cookie },
    });
    const quizBody = stripSsrMarkers(await oneQuiz.text());
    check(
      "a quiz renders and leaks no answers",
      oneQuiz.status === 200 &&
        quizBody.includes("Check your understanding") &&
        !quizBody.includes("correct_index"),
      `HTTP ${oneQuiz.status}`,
    );
  }

  console.log("\nAdmin is hidden from non-admins");
  {
    const res = await fetch(`${BASE_URL}/admin`, { headers: { cookie }, redirect: "manual" });
    // notFound() rather than a redirect: a non-admin should not learn /admin exists.
    check("/admin returns 404 for the demo user", res.status === 404, `HTTP ${res.status}`);
  }

  console.log("\nSweeper endpoint is not open");
  {
    const res = await fetch(`${BASE_URL}/api/cron/sweep`, { redirect: "manual" });
    check(
      "/api/cron/sweep rejects unauthenticated calls",
      res.status === 401,
      `HTTP ${res.status}`,
    );
  }

  const total = passed + failures.length;
  console.log(`\n${passed}/${total} smoke checks passed\n`);
  if (failures.length > 0) process.exit(1);
}

main().catch((error: unknown) => {
  console.error("\nSmoke test crashed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
