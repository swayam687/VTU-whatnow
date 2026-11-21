"use client";

import React, { useEffect, useState } from "react";

export default function SplashScreen() {
  const [isVisible, setIsVisible] = useState(true);
  const [isFading, setIsFading] = useState(false);
  const [isScaled, setIsScaled] = useState(false);

  useEffect(() => {
    // Trigger smooth scale expansion immediately after mount
    const scaleTimer = setTimeout(() => {
      setIsScaled(true);
    }, 20);

    // Start fade-out at exactly 700ms (0.7s)
    const fadeTimer = setTimeout(() => {
      setIsFading(true);
    }, 700);

    // Completely unmount/remove from DOM at 900ms (0.9s)
    const removeTimer = setTimeout(() => {
      setIsVisible(false);
    }, 900);

    return () => {
      clearTimeout(scaleTimer);
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white dark:bg-[#000000] select-none transition-opacity duration-200 ease-out ${
        isFading ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      aria-hidden="true"
    >
      <div className="flex flex-col items-center justify-center">
        {/* Mid-sized sharp square logo container with smooth scale transition */}
        <div className="w-32 h-32 sm:w-40 sm:h-40 flex items-center justify-center overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="App Logo"
            className={`w-full h-full object-contain rounded-none transform transition-transform duration-700 ease-out ${
              isScaled ? "scale-100" : "scale-90"
            }`}
            width={160}
            height={160}
            priority-attr="true"
          />
        </div>
      </div>
    </div>
  );
}
