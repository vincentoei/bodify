"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function ScrollMarquee() {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !textRef.current) return;

    let isMounted = true;
    let animationCtx: gsap.Context | null = null;

    const createAnimation = () => {
      if (!isMounted || !containerRef.current || !textRef.current) return;

      // Kill previous animation + ScrollTrigger before recreating
      animationCtx?.revert();

      animationCtx = gsap.context(() => {
        gsap.fromTo(
          textRef.current,
          { x: () => containerRef.current?.offsetWidth ?? 0 },
          {
            x: () => {
              if (!containerRef.current || !textRef.current) return 0;

              const viewportWidth = containerRef.current.offsetWidth;
              const textWidth = textRef.current.scrollWidth;
              const paddingRight =
                viewportWidth >= 1024 ? 32 : viewportWidth >= 640 ? 24 : 16;
              const contentWidth = Math.min(viewportWidth, 1280);
              const contentRightEdge =
                viewportWidth >= 1280
                  ? (viewportWidth + contentWidth) / 2
                  : viewportWidth - paddingRight;
              return contentRightEdge - textWidth;
            },
            ease: "none",
            scrollTrigger: {
              trigger: containerRef.current,
              start: "top bottom",
              end: "center center",
              scrub: 0.5,
            },
          }
        );
      });
    };

    // Initial animation
    createAnimation();

    // Recreate animation on container resize (covers browser zoom)
    const ro = new ResizeObserver(() => {
      createAnimation();
    });
    ro.observe(containerRef.current);

    return () => {
      isMounted = false;
      ro.disconnect();
      animationCtx?.revert();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden bg-brandDark py-16 sm:py-24"
    >
      <div ref={textRef} className="whitespace-nowrap">
        <span className="text-5xl font-bold tracking-tight text-offWhite sm:text-6xl lg:text-7xl">
          Your body isn&apos;t static.{" "}
          <span className="text-lightGreen">
            Your plan shouldn&apos;t be either.
          </span>
        </span>
      </div>
    </div>
  );
}
