import "./globals.css";
import type { Metadata, Viewport } from "next";

import ServiceWorkerRegister from "../components/ServiceWorkerRegister";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#000000",
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
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/logo.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/logo.png" },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icon-512.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#000000" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                if (document.readyState === 'complete') {
                  navigator.serviceWorker.register('/sw.js', { scope: '/' });
                } else {
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js', { scope: '/' });
                  });
                }
              }
              try {
                var savedTheme = localStorage.getItem('vtu_theme');
                var isObsidian = savedTheme !== 'paper';
                if (isObsidian) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col antialiased selection:bg-blue-500 selection:text-white">
        <ServiceWorkerRegister />

        <main className="flex-1 w-full flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
