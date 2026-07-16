"use client";

import { useState } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
  Gavel,
  CalendarDays,
  Mic,
  Sparkles,
  Shield,
  ChevronDown,
} from "lucide-react";

const features = [
  {
    icon: Gavel,
    title: "Multi-Agent Council",
    description:
      "Five specialized AI agents — Nutrition, Fitness, Medical, Behavioral, and Progress — collaborate to build your personalized plan.",
    color: "#AEE08F",
    texture: (
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="network" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
            <circle cx="10" cy="10" r="2" fill="currentColor" opacity="0.35" />
            <circle cx="50" cy="10" r="2" fill="currentColor" opacity="0.35" />
            <circle cx="10" cy="50" r="2" fill="currentColor" opacity="0.35" />
            <circle cx="50" cy="50" r="2" fill="currentColor" opacity="0.35" />
            <circle cx="30" cy="30" r="2.5" fill="currentColor" opacity="0.45" />
            <line x1="10" y1="10" x2="30" y2="30" stroke="currentColor" strokeWidth="0.9" opacity="0.3" />
            <line x1="50" y1="10" x2="30" y2="30" stroke="currentColor" strokeWidth="0.9" opacity="0.3" />
            <line x1="10" y1="50" x2="30" y2="30" stroke="currentColor" strokeWidth="0.9" opacity="0.3" />
            <line x1="50" y1="50" x2="30" y2="30" stroke="currentColor" strokeWidth="0.9" opacity="0.3" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#network)" />
      </svg>
    ),
  },
  {
    icon: CalendarDays,
    title: "Adaptive Calendar",
    description:
      "Life gets messy. Your plan automatically adjusts when you miss a workout, travel, get sick, or face unexpected schedule changes.",
    color: "#417D85",
    texture: (
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="calendar" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <rect width="40" height="40" fill="none" stroke="currentColor" strokeWidth="0.7" opacity="0.2" />
            <line x1="0" y1="10" x2="40" y2="10" stroke="currentColor" strokeWidth="0.6" opacity="0.18" />
            <line x1="0" y1="20" x2="40" y2="20" stroke="currentColor" strokeWidth="0.6" opacity="0.18" />
            <line x1="0" y1="30" x2="40" y2="30" stroke="currentColor" strokeWidth="0.6" opacity="0.18" />
            <line x1="10" y1="0" x2="10" y2="40" stroke="currentColor" strokeWidth="0.6" opacity="0.18" />
            <line x1="20" y1="0" x2="20" y2="40" stroke="currentColor" strokeWidth="0.6" opacity="0.18" />
            <line x1="30" y1="0" x2="30" y2="40" stroke="currentColor" strokeWidth="0.6" opacity="0.18" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#calendar)" />
      </svg>
    ),
  },
  {
    icon: Mic,
    title: "Speech-to-Text",
    description:
      "Bodify understands your fatigue throughout the day. Share your day, problems, and obstacles by speaking instead of typing — your agents listen.",
    color: "#6EB5F3",
    texture: (
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="soundwave" x="0" y="0" width="32" height="60" patternUnits="userSpaceOnUse">
            <rect x="2" y="20" width="3" height="20" rx="1.5" fill="currentColor" opacity="0.14" />
            <rect x="10" y="12" width="3" height="36" rx="1.5" fill="currentColor" opacity="0.17" />
            <rect x="18" y="8" width="3" height="44" rx="1.5" fill="currentColor" opacity="0.2" />
            <rect x="26" y="16" width="3" height="28" rx="1.5" fill="currentColor" opacity="0.14" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#soundwave)" />
      </svg>
    ),
  },
  {
    icon: Sparkles,
    title: "What-If Simulation",
    description:
      "Preview the impact of choices before you make them. Simulate schedule changes, diet shifts, and goal adjustments.",
    color: "#D4A853",
    texture: (
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="ripples" x="0" y="0" width="70" height="70" patternUnits="userSpaceOnUse">
            <circle cx="35" cy="35" r="8" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.22" />
            <circle cx="35" cy="35" r="16" fill="none" stroke="currentColor" strokeWidth="0.7" opacity="0.18" />
            <circle cx="35" cy="35" r="24" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.14" />
            <circle cx="35" cy="35" r="32" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#ripples)" />
      </svg>
    ),
  },
  {
    icon: Shield,
    title: "Evidence-Based",
    description:
      "Every recommendation is grounded in peer-reviewed research and clinical guidelines, not trends or guesswork.",
    color: "#417D85",
    texture: (
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="document" x="0" y="0" width="50" height="60" patternUnits="userSpaceOnUse">
            <line x1="8" y1="12" x2="42" y2="12" stroke="currentColor" strokeWidth="0.8" opacity="0.2" />
            <line x1="8" y1="20" x2="42" y2="20" stroke="currentColor" strokeWidth="0.8" opacity="0.2" />
            <line x1="8" y1="28" x2="42" y2="28" stroke="currentColor" strokeWidth="0.8" opacity="0.2" />
            <line x1="8" y1="36" x2="35" y2="36" stroke="currentColor" strokeWidth="0.8" opacity="0.2" />
            <line x1="8" y1="44" x2="38" y2="44" stroke="currentColor" strokeWidth="0.8" opacity="0.2" />
            <line x1="8" y1="52" x2="30" y2="52" stroke="currentColor" strokeWidth="0.8" opacity="0.2" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#document)" />
      </svg>
    ),
  },
];

export function AboutSection() {
  const [activeIndex, setActiveIndex] = useState(0);

  const ActiveIcon = features[activeIndex].icon;
  const activeFeature = features[activeIndex];

  return (
    <section className="relative z-10 bg-offWhite px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-16 text-center">
          <h2 className="text-4xl font-bold tracking-tight text-brandDark sm:text-5xl lg:text-7xl">
            Built for real life
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-base text-brandDark/60 sm:text-lg">
            A perfect plan is useless if it can&apos;t adapt. Bodify adapts to
            your schedule, your preferences, and your constraints — so you
            stay consistent even when life gets complicated.
          </p>
        </div>

        <LayoutGroup>
          <motion.div
            className="flex flex-col lg:flex-row gap-6"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            {/* Primary Card */}
            <div className="w-full lg:w-[55%]">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={activeFeature.title}
                  layoutId={activeFeature.title}
                  transition={{
                    layout: { duration: 0.5, ease: [0.32, 0.72, 0, 1] },
                  }}
                  className="relative h-full overflow-hidden rounded-2xl border border-brandDark/5 bg-white/80 p-8 shadow-sm backdrop-blur-sm flex flex-col justify-center"
                >
                  {/* Texture */}
                  <div
                    className="pointer-events-none absolute inset-0 text-current"
                    style={{ color: activeFeature.color, opacity: 0.75 }}
                  >
                    {activeFeature.texture}
                  </div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-5">
                      <h3 className="text-2xl font-bold text-brandDark">
                        {activeFeature.title}
                      </h3>
                      <ActiveIcon
                        className="h-7 w-7 shrink-0"
                        style={{ color: activeFeature.color }}
                      />
                    </div>
                    <p className="text-base leading-relaxed text-brandDark/60">
                      {activeFeature.description}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Secondary Cards */}
            <div className="w-full lg:w-[45%] grid grid-cols-2 gap-4">
              {features.map((feature, i) => {
                if (i === activeIndex) return null;
                return (
                  <motion.div
                    key={feature.title}
                    layoutId={feature.title}
                    transition={{
                      layout: { duration: 0.5, ease: [0.32, 0.72, 0, 1] },
                    }}
                    whileHover={{ scale: 1.03 }}
                    onClick={() => setActiveIndex(i)}
                    className="group relative cursor-pointer overflow-hidden rounded-2xl border border-brandDark/5 bg-white/80 p-5 shadow-sm backdrop-blur-sm flex flex-col items-center justify-center text-center min-h-[140px] transition-colors hover:bg-white"
                  >
                    {/* Texture */}
                    <div
                      className="pointer-events-none absolute inset-0 text-current transition-opacity duration-300 opacity-50 group-hover:opacity-80"
                      style={{ color: feature.color }}
                    >
                      {feature.texture}
                    </div>
                    <div className="relative z-10">
                      <h4 className="text-sm font-semibold text-brandDark">
                        {feature.title}
                      </h4>
                      <div className="mt-3 flex justify-center opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                        <ChevronDown className="h-5 w-5 text-brandDark/40 group-hover:text-brandDark/70" />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </LayoutGroup>
      </div>
    </section>
  );
}
