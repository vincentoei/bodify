"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ChevronRight, Loader2 } from "lucide-react";

interface FormCardProps {
  stepNumber: number;
  totalSteps: number;
  stepName: string;
  children: ReactNode;
  onNext?: () => void;
  onSubmit?: () => void;
  isReadOnly?: boolean;
  isLastStep?: boolean;
  loading?: boolean;
  delay?: number;
  canAdvance?: boolean;
}

export function FormCard({
  stepNumber,
  totalSteps,
  stepName,
  children,
  onNext,
  onSubmit,
  isReadOnly = false,
  isLastStep = false,
  loading = false,
  delay = 0,
  canAdvance = true,
}: FormCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: isReadOnly ? 0.6 : 1, y: 0 }}
      transition={{ duration: 0.3, delay: delay / 1000 }}
      className={`w-full max-w-2xl mx-auto ${isReadOnly ? "pointer-events-none" : ""}`}
    >
      <div className="rounded-2xl bg-white border shadow-sm overflow-hidden">
        {/* Progress bar */}
        <div className="px-6 pt-6 pb-2">
          <div className="flex gap-1 mb-4">
            {Array.from({ length: totalSteps }).map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 flex-1 rounded-full ${
                  idx < stepNumber ? "bg-primary" : "bg-zinc-200"
                }`}
              />
            ))}
          </div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {stepNumber} OF {totalSteps} · {stepName}
          </p>
        </div>

        {/* Edit note */}
        {!isReadOnly && (
          <div className="px-6 pb-2">
            <p className="text-xs text-muted-foreground">
              Don&apos;t worry — you can edit everything later in your Dashboard.
            </p>
          </div>
        )}

        {/* Form content */}
        <div className="px-6 py-4 space-y-6">{children}</div>

        {/* Action button */}
        {!isReadOnly && (
          <div className="px-6 pb-6 flex justify-end">
            {isLastStep ? (
              <Button onClick={onSubmit} disabled={loading || !canAdvance}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Building your plan...
                  </>
                ) : (
                  "Create My Plan"
                )}
              </Button>
            ) : (
              <Button onClick={onNext} disabled={!canAdvance}>
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
