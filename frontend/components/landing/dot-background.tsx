"use client";

import { useEffect, useRef } from "react";

interface Dot {
  baseX: number;
  baseY: number;
  size: number;
  opacity: number;
  color: string;
}

export function DotBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const dotsRef = useRef<Dot[]>([]);
  const animationRef = useRef<number>(0);
  const timeRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const colors = ["#AEE08F", "#417D85", "#6EB5F3"];
    const waveSpeed = 0.003;
    const waveAmp = 18;
    const waveFreq = 0.015;

    function resize() {
      if (!container || !canvas || !ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const w = container.offsetWidth;
      const h = container.offsetHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initDots();
    }

    function initDots() {
      if (!container || !canvas) return;
      const spacing = 40;
      const w = container.offsetWidth;
      const h = container.offsetHeight;
      const cols = Math.ceil(w / spacing) + 1;
      const rows = Math.ceil(h / spacing) + 1;
      const dots: Dot[] = [];

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          dots.push({
            baseX: i * spacing + spacing / 2,
            baseY: j * spacing + spacing / 2,
            size: 1.5,
            opacity: 0.15,
            color: colors[Math.floor(Math.random() * colors.length)],
          });
        }
      }
      dotsRef.current = dots;
    }

    function animate() {
      if (!container || !canvas || !ctx) return;
      const w = container.offsetWidth;
      const h = container.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      timeRef.current += 1;
      const t = timeRef.current * waveSpeed;
      const mouse = mouseRef.current;
      const radius = 160;

      for (const dot of dotsRef.current) {
        const phase = (dot.baseX + dot.baseY) * waveFreq + t;
        const x = dot.baseX + Math.cos(phase) * waveAmp;
        const y = dot.baseY + Math.sin(phase) * waveAmp;

        const dx = mouse.x - x;
        const dy = mouse.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let targetSize = 1.5;
        let targetOpacity = 0.15;

        if (dist < radius) {
          const force = (radius - dist) / radius;
          targetSize = 1.5 + force * 4;
          targetOpacity = 0.15 + force * 0.85;
        }

        dot.size += (targetSize - dot.size) * 0.12;
        dot.opacity += (targetOpacity - dot.opacity) * 0.12;

        ctx.beginPath();
        ctx.arc(x, y, dot.size, 0, Math.PI * 2);
        ctx.fillStyle = dot.color;
        ctx.globalAlpha = dot.opacity;
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      animationRef.current = requestAnimationFrame(animate);
    }

    function handleMouseMove(e: MouseEvent) {
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
        mouseRef.current = { x, y };
      } else {
        mouseRef.current = { x: -1000, y: -1000 };
      }
    }

    function handleMouseLeave() {
      mouseRef.current = { x: -1000, y: -1000 };
    }

    resize();
    animate();

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    // Pause animation when off-screen to prevent compositing glitches
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!animationRef.current) animate();
        } else {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = 0;
        }
      },
      { threshold: 0 }
    );
    observer.observe(container);

    return () => {
      cancelAnimationFrame(animationRef.current);
      observer.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 z-0 pointer-events-none">
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ background: "#EFEFEF" }}
      />
    </div>
  );
}
