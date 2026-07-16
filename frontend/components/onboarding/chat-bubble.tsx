"use client";

import { motion } from "framer-motion";
import Image from "next/image";

interface ChatBubbleProps {
  message?: string;
  isThinking?: boolean;
  delay?: number;
}

export function ChatBubble({ message, isThinking = false, delay = 0 }: ChatBubbleProps) {
  const avatar = (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <div className="relative h-8 w-8 rounded-full overflow-hidden border shadow-sm">
        <Image
          src="/bodify-mascot.png"
          alt="Bodi"
          fill
          className="object-cover"
        />
      </div>
      <span className="text-[10px] font-medium text-muted-foreground">Bodi</span>
    </div>
  );

  if (isThinking) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: delay / 1000 }}
        className="flex items-start gap-2"
      >
        {avatar}
        <div className="rounded-2xl rounded-tl-sm bg-white border px-4 py-3 shadow-sm">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span>Thinking</span>
            <span className="flex gap-0.5">
              <span className="h-1 w-1 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="h-1 w-1 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="h-1 w-1 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
            </span>
          </div>
        </div>
      </motion.div>
    );
  }

  if (!message) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: delay / 1000 }}
      className="flex items-start gap-2"
    >
      {avatar}
      <div className="rounded-2xl rounded-tl-sm bg-white border px-4 py-3 shadow-sm max-w-[85%]">
        <p className="text-sm leading-relaxed">{message}</p>
      </div>
    </motion.div>
  );
}
