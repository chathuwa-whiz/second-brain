import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Second Brain",
  description: "Agent action log and approval queue",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
