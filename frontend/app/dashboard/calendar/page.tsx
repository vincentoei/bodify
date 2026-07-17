"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiGet, apiPost } from "@/lib/api";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import {
  EVENT_ICONS,
  EVENT_COLORS,
  fallbackEventColor,
} from "@/lib/event-types";

interface CalendarEvent {
  id: string;
  date: string;
  type: string;
  title: string;
  description?: string;
  status: string;
}

export default function CalendarPage() {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CalendarEvent | null>(null);

  const startOfWeek = useMemo(() => {
    const d = new Date(currentWeek);
    d.setDate(currentWeek.getDate() - currentWeek.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }, [currentWeek]);

  const endOfWeek = useMemo(() => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [startOfWeek]);

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    try {
      // Lazy weekly regeneration: if the user rolled into a new week,
      // generate the current week's events before fetching them.
      const status = await apiGet<{ needs_regeneration: boolean }>("/plan/status");
      if (status.needs_regeneration) {
        await apiPost("/plan/regenerate-week", {});
      }

      const data = await apiGet<{ events: CalendarEvent[] }>(
        `/calendar/?start=${startOfWeek.toISOString()}&end=${endOfWeek.toISOString()}`
      );
      setEvents(data.events || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [startOfWeek, endOfWeek]);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  // Refetch when the tab becomes visible again (e.g. after Recovery chat updates).
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        loadCalendar();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [loadCalendar]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      return d;
    });
  }, [startOfWeek]);

  const eventsForDay = (day: Date) =>
    events.filter((e) => {
      const d = new Date(e.date);
      return d.toDateString() === day.toDateString();
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Health Calendar</h1>
          <p className="text-muted-foreground">
            Your adaptive schedule for the week. Events roll over weekly — next
            week&apos;s schedule generates automatically when your current week
            ends.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const d = new Date(currentWeek);
              d.setDate(d.getDate() - 7);
              setCurrentWeek(d);
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[140px] text-center text-sm font-medium">
            {startOfWeek.toLocaleDateString(undefined, { month: "short", day: "numeric" })} -{" "}
            {endOfWeek.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const d = new Date(currentWeek);
              d.setDate(d.getDate() + 7);
              setCurrentWeek(d);
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading calendar...</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-7">
          {weekDays.map((day) => {
            const isToday = day.toDateString() === new Date().toDateString();
            const dayEvents = eventsForDay(day);
            return (
              <Card key={day.toISOString()} className={isToday ? "border-primary" : ""}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    {day.toLocaleDateString(undefined, { weekday: "short" })}
                  </CardTitle>
                  <p className={`text-2xl font-bold ${isToday ? "text-primary" : ""}`}>
                    {day.getDate()}
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {dayEvents.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No events</p>
                  ) : (
                    dayEvents.map((event) => {
                      const Icon = EVENT_ICONS[event.type] || Clock;
                      const color = EVENT_COLORS[event.type] || fallbackEventColor;
                      const time = new Date(event.date).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      const badgeExtra =
                        event.status === "completed"
                          ? "font-semibold line-through"
                          : event.status === "skipped"
                          ? "font-semibold"
                          : "";
                      return (
                        <button
                          key={event.id}
                          type="button"
                          onClick={() => setSelected(event)}
                          className={`group relative w-full rounded-md border p-2 text-left text-xs transition-colors hover:opacity-90 ${color.card}`}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="h-3 w-3 shrink-0" />
                            <span className="font-medium">{time}</span>
                            <span className="truncate">{event.title}</span>
                          </div>
                          {event.description && (
                            <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                              {event.description}
                            </p>
                          )}
                          <div className="mt-1">
                            <span
                              className={`inline-block rounded px-1.5 py-0.5 text-[10px] capitalize ${color.badge} ${badgeExtra}`}
                            >
                              {event.status}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent className="max-w-md">
          {selected && (() => {
            const Icon = EVENT_ICONS[selected.type] || Clock;
            const color = EVENT_COLORS[selected.type] || fallbackEventColor;
            const iconWrapClasses = `mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${color.iconWrap}`;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 pr-6">
                    <span className={iconWrapClasses}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span>{selected.title}</span>
                  </DialogTitle>
                  <DialogDescription>
                    {new Date(selected.date).toLocaleString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </DialogDescription>
                </DialogHeader>

                {selected.description && (
                  <div className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm text-brandDark/90">
                    {selected.description}
                  </div>
                )}

                <p className="text-xs text-muted-foreground capitalize">
                  Status: {selected.status}
                </p>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

    </div>
  );
}
