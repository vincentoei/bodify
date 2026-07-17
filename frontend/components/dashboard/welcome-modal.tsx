"use client";

import { useState } from "react";
import Image from "next/image";
import { Brain, Flame, Dumbbell, Droplets, Moon, Footprints } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface WelcomeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: any;
}

export function WelcomeModal({ open, onOpenChange, plan }: WelcomeModalProps) {
  const [imageError, setImageError] = useState(false);

  const final = plan?.final_recommendation;
  const resolutionSummary = plan?.resolution_summary || "Your personalized plan is ready.";

  const highlights = [
    {
      icon: Flame,
      label: "Calorie target",
      value: final?.calorie_target ? `${final.calorie_target} kcal` : "—",
    },
    {
      icon: Dumbbell,
      label: "Workouts",
      value: final?.weekly_workouts ? `${final.weekly_workouts} / week` : "—",
    },
    {
      icon: Droplets,
      label: "Hydration",
      value: final?.hydration_liters ? `${final.hydration_liters} L` : "—",
    },
    {
      icon: Moon,
      label: "Sleep",
      value: final?.sleep_hours_target ? `${final.sleep_hours_target} hrs` : "—",
    },
    {
      icon: Footprints,
      label: "Daily steps",
      value: final?.daily_steps_goal ? `${final.daily_steps_goal.toLocaleString()}` : "—",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4">
            {imageError ? (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 border border-green-200">
                <Brain className="h-10 w-10 text-green-600" />
              </div>
            ) : (
              <Image
                src="/bodify-mascot.png"
                alt="Bodi"
                width={80}
                height={80}
                className="rounded-full border border-green-200 bg-green-50 object-cover"
                onError={() => setImageError(true)}
                priority
              />
            )}
          </div>
          <DialogTitle className="text-2xl">Ready to meet your best self?</DialogTitle>
          <DialogDescription className="text-base">
            I reviewed input from all 5 specialists and here&apos;s the plan we agreed on for you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div className="rounded-xl border border-green-100 bg-green-50/50 p-4">
            <p className="text-sm font-medium text-green-800 mb-1">Bodi&apos;s opinion</p>
            <p className="text-sm leading-relaxed text-green-900">{resolutionSummary}</p>
          </div>

          {final && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {highlights.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="flex flex-col items-center justify-center rounded-lg border p-3 text-center"
                  >
                    <Icon className="mb-2 h-5 w-5 text-muted-foreground" />
                    <p className="text-lg font-semibold">{item.value}</p>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Button onClick={() => onOpenChange(false)} className="w-full">
          Start my journey
        </Button>
      </DialogContent>
    </Dialog>
  );
}
