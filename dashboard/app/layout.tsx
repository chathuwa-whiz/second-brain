import type { Metadata, Viewport } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ThemeProvider, themeBootstrapScript } from "@/components/theme";
import Providers from "@/components/Providers";
import ShellGate from "@/components/ShellGate";
import Mesh from "@/components/Mesh";
import "./globals.css";

export const metadata: Metadata = {
  title: "Second Brain — Control panel",
  description:
    "Oversight and controls for the second-brain agent: approvals, activity, and modules.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F7FC" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1020" },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Sets the theme before first paint so there's no flash on load. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body>
        <ThemeProvider>
          <Providers>
            <Mesh />
            {session ? (
              <ShellGate user={session.user}>{children}</ShellGate>
            ) : (
              children
            )}
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
