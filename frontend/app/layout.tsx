import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Field Shift — Climate-resilient crop rotations",
  description: "Compare three-year crop strategies using NASA climate records, estimated soil conditions, and transparent agronomic rules.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
