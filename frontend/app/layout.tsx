import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VTU WhatNow - Semester Results & Branch Analytics",
  description: "Fast, elegant semester results explorer, branch rankings, and subject performance analytics for VTU engineering students.",
  icons: {
    icon: "/icon.svg",
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
