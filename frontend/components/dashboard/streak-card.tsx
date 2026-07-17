"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Flame, CalendarCheck, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const STREAK_HELPER =
  "Counts consecutive days where you completed at least 3 out of all scheduled events that day. Today doesn't break the streak if still in progress.";
const WEEKLY_HELPER =
  "Number of calendar events marked completed since Monday.";

interface StreakCardProps {
  streakDays: number;
  weeklyCompleted: number;
  className?: string;
}

export function StreakCard({ streakDays, weeklyCompleted, className }: StreakCardProps) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 h-full", className)}>
      <Card className="relative flex-1 bg-gradient-to-br from-orange-50 to-white border-orange-100">
        <CardContent className="flex items-center gap-4 p-5 h-full">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="How day streak is calculated"
                  className="absolute right-3 top-3 text-muted-foreground/60 hover:text-muted-foreground"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{STREAK_HELPER}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600">
            <Flame className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-brandDark">{streakDays}</p>
            <p className="text-sm text-muted-foreground">
              {streakDays} day streak
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="relative flex-1 bg-gradient-to-br from-blue-50 to-white border-blue-100">
        <CardContent className="flex items-center gap-4 p-5 h-full">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="How weekly completed is calculated"
                  className="absolute right-3 top-3 text-muted-foreground/60 hover:text-muted-foreground"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{WEEKLY_HELPER}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            <CalendarCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-brandDark">{weeklyCompleted}</p>
            <p className="text-sm text-muted-foreground">events completed this week</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
