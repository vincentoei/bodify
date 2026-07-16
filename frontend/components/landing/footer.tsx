"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Shield } from "lucide-react";
import Image from "next/image";

gsap.registerPlugin(ScrollTrigger);

export function Footer() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const taglineRef = useRef<HTMLDivElement>(null);
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const tagline = "Every Body Has a Different Journey.";

  useEffect(() => {
    if (!sectionRef.current || !taglineRef.current) return;

    const ctx = gsap.context(() => {
      // Animate each letter of the tagline with stagger
      gsap.fromTo(
        letterRefs.current.filter(Boolean),
        { opacity: 0, y: 60, rotateX: -90 },
        {
          opacity: 1,
          y: 0,
          rotateX: 0,
          duration: 0.8,
          ease: "back.out(1.7)",
          stagger: 0.03,
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 75%",
            toggleActions: "play none none none",
          },
        }
      );

      // Fade in bottom bar
      gsap.fromTo(
        bottomRef.current,
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: "power2.out",
          scrollTrigger: {
            trigger: bottomRef.current,
            start: "top 95%",
            toggleActions: "play none none none",
          },
        }
      );
    });

    return () => ctx.revert();
  }, []);

  return (
    <footer
      ref={sectionRef}
      className="relative overflow-hidden bg-brandDark px-4 pt-32 pb-8 sm:px-6 sm:pt-40 lg:px-8 lg:pt-48"
    >
      {/* Subtle background gradient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -left-1/4 -top-1/4 h-[600px] w-[600px] rounded-full opacity-[0.04] blur-[120px]"
          style={{ backgroundColor: "#AEE08F" }}
        />
        <div
          className="absolute -right-1/4 bottom-0 h-[500px] w-[500px] rounded-full opacity-[0.03] blur-[100px]"
          style={{ backgroundColor: "#6EB5F3" }}
        />
      </div>

      {/* Main Content */}
      <div className="relative mx-auto max-w-7xl">
        {/* Giant Tagline */}
        <div className="mb-20 text-center">
          <div
            ref={taglineRef}
            className="inline-block"
            style={{ perspective: 1000 }}
          >
            <h2 className="text-4xl font-bold tracking-tight text-offWhite sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl">
              {tagline.split("").map((char, i) => (
                <span
                  key={i}
                  ref={(el) => { letterRefs.current[i] = el; }}
                  className="inline-block"
                  style={{
                    transformStyle: "preserve-3d",
                    minWidth: char === " " ? "0.3em" : undefined,
                  }}
                >
                  {char === " " ? "\u00A0" : char}
                </span>
              ))}
            </h2>
          </div>
        </div>

        {/* Massive brand wordmark */}
        <div className="mb-24 flex justify-center">
          <div className="relative">
            <span
              className="select-none text-[12vw] font-black leading-none tracking-tighter text-transparent sm:text-[10vw] lg:text-[8vw]"
              style={{
                WebkitTextStroke: "1px rgba(239, 239, 239, 0.15)",
              }}
            >
              BODIFY
            </span>
            <div className="absolute inset-0 flex items-center justify-center">
              <Image
                src="/bodify-logo.svg"
                alt="Bodify"
                width={200}
                height={60}
                className="h-12 w-auto opacity-80 sm:h-16 lg:h-20"
              />
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div
          ref={bottomRef}
          className="border-t border-offWhite/10 pt-8"
        >
          <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
            <p className="text-xs text-offWhite/40">
              © {new Date().getFullYear()} Bodify. All rights reserved.
            </p>

            <div className="flex items-center gap-1.5 text-xs text-offWhite/40">
              <Shield className="h-3.5 w-3.5 text-lightGreen/60" />
              <span>Decision support, not medical advice.</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
