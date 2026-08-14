import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { LocaleProvider } from "@/components/locale-provider";
import { getLocale } from "@/lib/i18n-server";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Champio — Empowering the Next Generation of Champions",
    template: "%s · Champio",
  },
  description:
    "Structured learning tracks and AI-powered proposal diagnostics for Indonesian students competing in business case, business plan and essay competitions.",
};

export const viewport: Viewport = {
  themeColor: "#240046",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Resolved once here so `<html lang>` is correct for screen readers and
  // hyphenation, and so client components can read it from context.
  const locale = await getLocale();

  return (
    <html lang={locale} className={`${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <LocaleProvider locale={locale}>
          {children}
          <Toaster position="top-center" richColors />
        </LocaleProvider>
      </body>
    </html>
  );
}
