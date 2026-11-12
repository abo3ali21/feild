import type { Metadata } from "next";
import { Noto_Sans_Arabic } from "next/font/google";
import { LangProvider } from "./lang";
import "./globals.css";

const arabic = Noto_Sans_Arabic({
  subsets: ["arabic", "latin"],
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
    <html lang="en" dir="ltr" suppressHydrationWarning className={arabic.variable}>
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: restoreDirection }} />
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
