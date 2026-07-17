"use client";

import Image from "next/image";
import { useState } from "react";

interface GreetingProps {
  fullName?: string | null;
}

export function Greeting({ fullName }: GreetingProps) {
  const [imageError, setImageError] = useState(false);
  const hour = new Date().getHours();
  let timeLabel = "Good morning";
  if (hour >= 12 && hour < 17) timeLabel = "Good afternoon";
  if (hour >= 17) timeLabel = "Good evening";

  const displayName = fullName?.trim() || "there";
  const greeting = `${timeLabel}, ${displayName}`;

  return (
    <div className="rounded-2xl border border-green-100 bg-gradient-to-br from-green-50 to-white p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-green-200 bg-green-50">
          {!imageError ? (
            <Image
              src="/bodify-mascot.png"
              alt="Bodi"
              fill
              className="object-cover"
              onError={() => setImageError(true)}
              priority
            />
          ) : (
            <span className="text-lg font-bold text-green-600">B</span>
          )}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-brandDark">{greeting}</h2>
          <p className="mt-1 text-brandDark/70">
            Here&apos;s your personalized plan for today. Small consistent steps lead to
            sustainable progress.
          </p>
        </div>
      </div>
    </div>
  );
}
