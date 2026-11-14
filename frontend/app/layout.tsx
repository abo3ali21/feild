import type { Metadata } from "next";
import localFont from "next/font/local";
import { LangProvider } from "./lang";
import "./globals.css";

const firjarArabic = localFont({
  src: [
    {
      path: "../public/fonts/Firjar-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/Firjar-Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/fonts/Firjar-SemiBold.ttf",
      weight: "600",
      style: "normal",
    },
    {
      path: "../public/fonts/Firjar-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Field Shift — Climate-resilient crop rotations",
  description: "Compare three-year crop strategies using NASA climate records, estimated soil conditions, and transparent agronomic rules.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

// Applies the stored language/direction before first paint so RTL layout never
// flashes; React still renders with its default English/LTR output.
const restoreDirection = `try{var l=localStorage.getItem("fieldshift.lang");if(l==="ar"||l==="en"){document.documentElement.lang=l;document.documentElement.dir=l==="ar"?"rtl":"ltr";}}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning className={firjarArabic.variable}>
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: restoreDirection }} />
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
