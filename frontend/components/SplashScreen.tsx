"use client";

import React, { useEffect, useState } from "react";

export default function SplashScreen() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Unmount immediately once the app has booted and rendered
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 150);

    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-white dark:bg-[#000000] select-none"
      aria-hidden="true"
    >
      <div className="w-32 h-32 sm:w-40 sm:h-40 flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="App Logo"
          className="w-full h-full object-contain rounded-none"
          width={160}
          height={160}
        />
      </div>
    </div>
  );
}
