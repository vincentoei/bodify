"use client";

import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import {
  EVENT_ICONS,
  EVENT_COLORS,
  fallbackEventColor,
} from "@/lib/event-types";

interface EventCardProps {
  event: {
    id: string;
    date: string;
    type: string;
    title: string;
    description?: string;
    status: string;
  };
}

export function EventCard({ event }: EventCardProps) {
  const Icon = EVENT_ICONS[event.type] || Clock;
  const color = EVENT_COLORS[event.type] || fallbackEventColor;
  const time = new Date(event.date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const isCompleted = event.status === "completed";
  const isSkipped = event.status === "skipped";

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-4 transition-colors sm:flex-row sm:items-center sm:justify-between ${color.card}`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${color.iconWrap}`}>
          {isCompleted ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : isSkipped ? (
            <XCircle className="h-5 w-5 text-red-500" />
          ) : (
            <Icon className="h-5 w-5" />
          )}
        </div>
        <div>
          <p className="font-medium text-brandDark">
            {time} · {event.title}
          </p>
          {event.description && (
            <p className="text-sm text-muted-foreground">{event.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end">
        <Badge
          variant={isCompleted ? "default" : isSkipped ? "destructive" : "secondary"}
          className="capitalize"
        >
          {event.status}
        </Badge>
      </div>
    </div>
  );
}
