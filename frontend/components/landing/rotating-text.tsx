"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const phrases = [
  "Bodify evolves with you.",
  "Bodify adapts with you.",
  "Bodify transforms with you.",
  "Bodify learns with you.",
  "Bodify optimizes with you.",
];

export function RotatingText() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % phrases.length);
    }, 2600);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="relative inline-block min-h-[1.4em] overflow-hidden whitespace-nowrap align-bottom py-1">
      <AnimatePresence mode="wait">
        <motion.span
          key={index}
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "-100%", opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="inline-block"
        >
          <span className="text-darkGreen">{phrases[index]}</span>
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
