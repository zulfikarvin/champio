/**
 * Minimal i18n.
 *
 * A flat dictionary per locale and a `t()` lookup. No framework: message
 * extraction, plural rules and lazy-loaded catalogues would be weight this app
 * does not yet need, and swapping one in later is a mechanical change because
 * every string already goes through a single function.
 *
 * What this can and cannot switch is worth being clear about. UI chrome —
 * navigation, buttons, headings, form labels — is translated here. Three things
 * are not, because they are content rather than interface:
 *
 *   - learning articles, which are written in the database
 *   - compiled rubrics, which keep the language of the guidebook they came from
 *   - evaluation feedback, which the model writes in the language of the document
 *
 * That last one is deliberate: an Indonesian proposal gets Indonesian feedback
 * regardless of this setting, because the feedback quotes the document.
 */

export const LOCALES = ["en", "id"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "EN",
  id: "ID",
};

export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  id: "Bahasa Indonesia",
};

export function isLocale(value: string | undefined): value is Locale {
  return value === "en" || value === "id";
}

const en = {
  "app.name": "Champio",
  "app.tagline": "Empowering the Next Generation of Champions",

  // ---------------------------------------------------------------- navigation
  "nav.tracks": "Learning Tracks",
  "nav.proposals": "Competitions",
  "nav.library": "Reference Library",
  "nav.dashboard": "Dashboard",
  "nav.settings": "Settings",
  "nav.admin": "Admin",
  "nav.signOut": "Sign out",
  "nav.language": "Language",

  // --------------------------------------------------------------------- auth
  "auth.signIn": "Sign in",
  "auth.signUp": "Create account",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.fullName": "Full name",
  "auth.university": "University",
  "auth.haveAccount": "Already have an account?",
  "auth.noAccount": "New to Champio?",
  "auth.checkEmail": "Check your email to confirm your account.",
  "auth.welcomeBack": "Welcome back",
  "auth.welcomeBackSub": "Pick up where your team left off.",
  "auth.startCompeting": "Start competing",
  "auth.startCompetingSub": "Create your account, then set up your team.",

  // --------------------------------------------------------------------- team
  "team.create": "Create a team",
  "team.name": "Team name",
  "team.switch": "Switch team",
  "team.members": "Members",
  "team.owner": "Owner",
  "team.member": "Member",
  "team.none": "You are not on a team yet.",
  "team.created": "Team created.",
  "team.setup": "Set up your team",
  "team.setupSub":
    "Everything in Champio — competitions, rubrics, diagnostics — belongs to a team. Create one to get started.",

  // ---------------------------------------------------------------- dashboard
  "dash.workspace": "Team workspace",
  "dash.diagnose": "Diagnose a proposal",
  "dash.diagnoseSub":
    "Upload a draft and get rubric-aligned, evidence-cited feedback.",
  "dash.openProposals": "Open competitions",
  "dash.buildSkills": "Build the skills",
  "dash.buildSkillsSub": "Read the articles, then test yourself when you want to.",
  "dash.openTracks": "Open tracks",
  "dash.yourTracks": "Your tracks",
  "dash.viewAll": "View all",
  "dash.proposalsInProgress": "{count} competition(s) in progress.",

  // ------------------------------------------------------------------ tracks
  "tracks.title": "Learning Tracks",
  "tracks.subtitle":
    "Read the articles in any order. Quizzes are a separate, optional self-check.",
  "tracks.comingSoon": "Content coming soon",
  "tracks.open": "Open",
  "tracks.openTrack": "Open track",
  "tracks.continue": "Continue",
  "tracks.quizzesLabel": "quizzes",

  // ---------------------------------------------------------------- landing
  "landing.badge": "For Indonesian student competition enthusiasts",
  "landing.heroSub":
    "Champio turns competition preparation into a loop you can actually run: learn the frameworks, submit a draft, get scored feedback, and watch your score climb version over version.",
  "landing.startFree": "Start free",
  "landing.getStarted": "Get started",
  "landing.featuresTitle": "Feedback specific enough to act on",
  "landing.featuresSub":
    "Not “strengthen your analysis” — which slide, what to change, and what it is worth.",
  "landing.tracksTitle": "Three tracks, built around how each format is judged",
  "landing.ctaTitle": "Your next submission should score higher than your last",
  "landing.ctaButton": "Create your team",
  "landing.footer": "Built for Indonesian student competitors.",

  // ------------------------------------------------------------------ common
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.loading": "Loading…",
  "common.draft": "DRAFT",
} as const;

export type MessageKey = keyof typeof en;

/**
 * Bahasa Indonesia.
 *
 * Partial by type, so a key added to `en` does not break the build — it falls
 * back to English until translated, which degrades to readable text rather than
 * a blank screen.
 */
const id: Partial<Record<MessageKey, string>> = {
  "app.name": "Champio",
  "app.tagline": "Membangun Generasi Juara Berikutnya",

  "nav.tracks": "Jalur Belajar",
  "nav.proposals": "Kompetisi",
  "nav.library": "Perpustakaan Referensi",
  "nav.dashboard": "Beranda",
  "nav.settings": "Pengaturan",
  "nav.admin": "Admin",
  "nav.signOut": "Keluar",
  "nav.language": "Bahasa",

  "auth.signIn": "Masuk",
  "auth.signUp": "Buat akun",
  "auth.email": "Email",
  "auth.password": "Kata sandi",
  "auth.fullName": "Nama lengkap",
  "auth.university": "Universitas",
  "auth.haveAccount": "Sudah punya akun?",
  "auth.noAccount": "Baru di Champio?",
  "auth.checkEmail": "Cek email kamu untuk mengonfirmasi akun.",
  "auth.welcomeBack": "Selamat datang kembali",
  "auth.welcomeBackSub": "Lanjutkan dari tempat timmu berhenti.",
  "auth.startCompeting": "Mulai berkompetisi",
  "auth.startCompetingSub": "Buat akunmu, lalu siapkan timmu.",

  "team.create": "Buat tim",
  "team.name": "Nama tim",
  "team.switch": "Ganti tim",
  "team.members": "Anggota",
  "team.owner": "Pemilik",
  "team.member": "Anggota",
  "team.none": "Kamu belum tergabung dalam tim.",
  "team.created": "Tim berhasil dibuat.",
  "team.setup": "Siapkan timmu",
  "team.setupSub":
    "Semua yang ada di Champio — kompetisi, rubrik, diagnostik — dimiliki oleh sebuah tim. Buat satu untuk memulai.",

  "dash.workspace": "Ruang kerja tim",
  "dash.diagnose": "Analisis proposal",
  "dash.diagnoseSub":
    "Unggah draf dan dapatkan masukan sesuai rubrik, lengkap dengan kutipan bukti.",
  "dash.openProposals": "Buka kompetisi",
  "dash.buildSkills": "Bangun kemampuan",
  "dash.buildSkillsSub": "Baca artikelnya, lalu uji dirimu kapan pun kamu mau.",
  "dash.openTracks": "Buka jalur belajar",
  "dash.yourTracks": "Jalur belajarmu",
  "dash.viewAll": "Lihat semua",
  "dash.proposalsInProgress": "{count} kompetisi sedang berjalan.",

  "tracks.title": "Jalur Belajar",
  "tracks.subtitle":
    "Baca artikelnya dalam urutan bebas. Kuis adalah uji mandiri terpisah dan opsional.",
  "tracks.comingSoon": "Konten segera hadir",
  "tracks.open": "Buka",
  "tracks.openTrack": "Buka jalur",
  "tracks.continue": "Lanjutkan",
  "tracks.quizzesLabel": "kuis",

  "landing.badge": "Untuk mahasiswa Indonesia penggemar kompetisi",
  "landing.heroSub":
    "Champio mengubah persiapan kompetisi menjadi siklus yang benar-benar bisa kamu jalankan: pelajari kerangkanya, kirim draf, terima penilaian, dan lihat skormu naik dari versi ke versi.",
  "landing.startFree": "Mulai gratis",
  "landing.getStarted": "Mulai sekarang",
  "landing.featuresTitle": "Masukan yang cukup spesifik untuk ditindaklanjuti",
  "landing.featuresSub":
    "Bukan “perkuat analisismu” — tapi slide mana, apa yang harus diubah, dan seberapa besar pengaruhnya.",
  "landing.tracksTitle":
    "Tiga jalur belajar, disusun sesuai cara tiap format dinilai",
  "landing.ctaTitle": "Kiriman berikutnya harus lebih tinggi dari sebelumnya",
  "landing.ctaButton": "Buat timmu",
  "landing.footer": "Dibuat untuk mahasiswa Indonesia yang berkompetisi.",

  "common.save": "Simpan",
  "common.cancel": "Batal",
  "common.loading": "Memuat…",
  "common.draft": "DRAF",
};

const dictionaries: Record<Locale, Partial<Record<MessageKey, string>>> = {
  en,
  id,
};

/**
 * Looks up a string, with `{name}` interpolation.
 *
 * Falls back to English, then to the key itself, so a missing translation shows
 * readable text rather than an empty element.
 */
export function t(
  key: MessageKey,
  vars?: Record<string, string | number>,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const template = dictionaries[locale][key] ?? en[key] ?? key;

  if (!vars) return template;

  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/** A `t` bound to one locale, so call sites do not repeat it. */
export type Translator = (
  key: MessageKey,
  vars?: Record<string, string | number>,
) => string;

export function translatorFor(locale: Locale): Translator {
  return (key, vars) => t(key, vars, locale);
}
