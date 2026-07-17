import { Utensils, Dumbbell, Droplets, Moon, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const EVENT_ICONS: Record<string, LucideIcon> = {
  meal: Utensils,
  workout: Dumbbell,
  hydration: Droplets,
  sleep: Moon,
  recovery: Clock,
  checkin: Clock,
};

export interface EventTypeColor {
  card: string;
  iconWrap: string;
  badge: string;
}

export const EVENT_COLORS: Record<string, EventTypeColor> = {
  meal: {
    card: "border-emerald-200 bg-emerald-50",
    iconWrap: "border-emerald-100 bg-emerald-50 text-emerald-600",
    badge: "bg-emerald-100 text-emerald-700",
  },
  workout: {
    card: "border-blue-200 bg-blue-50",
    iconWrap: "border-blue-100 bg-blue-50 text-blue-600",
    badge: "bg-blue-100 text-blue-700",
  },
  hydration: {
    card: "border-cyan-200 bg-cyan-50",
    iconWrap: "border-cyan-100 bg-cyan-50 text-cyan-600",
    badge: "bg-cyan-100 text-cyan-700",
  },
  sleep: {
    card: "border-indigo-200 bg-indigo-50",
    iconWrap: "border-indigo-100 bg-indigo-50 text-indigo-600",
    badge: "bg-indigo-100 text-indigo-700",
  },
  recovery: {
    card: "border-purple-200 bg-purple-50",
    iconWrap: "border-purple-100 bg-purple-50 text-purple-600",
    badge: "bg-purple-100 text-purple-700",
  },
  checkin: {
    card: "border-zinc-200 bg-zinc-50",
    iconWrap: "border-zinc-100 bg-zinc-50 text-zinc-600",
    badge: "bg-zinc-100 text-zinc-700",
  },
};

export const fallbackEventColor: EventTypeColor = EVENT_COLORS.checkin;