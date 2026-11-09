import "./globals.css";
import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#08090a",
};

export const metadata: Metadata = {
  title: "VTU WhatNow - Semester Results & Branch Analytics",
  description: "Fast, elegant semester results explorer, branch rankings, and subject performance analytics for VTU engineering students.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "VTU WhatNow",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col antialiased selection:bg-blue-500 selection:text-white">
        <main className="flex-1 w-full flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
