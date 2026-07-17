"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost } from "@/lib/api";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import {
  CalendarDays,
  Flame,
  Droplets,
  Moon,
  Footprints,
  Dumbbell,
  Beef,
  Wheat,
  Droplet,
  Scale,
} from "lucide-react";
import { WelcomeModal } from "@/components/dashboard/welcome-modal";
import { Greeting } from "@/components/dashboard/greeting";
import { MetricProgress } from "@/components/dashboard/metric-progress";

import { QuickActions } from "@/components/dashboard/quick-actions";
import { StreakCard } from "@/components/dashboard/streak-card";
import { EventCard } from "@/components/dashboard/event-card";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { DailyLog, DailyLogResult } from "@/components/dashboard/daily-log";

interface CalendarEvent {
  id: string;
  date: string;
  type: string;
  title: string;
  description?: string;
  status: "pending" | "completed" | "skipped" | "rescheduled";
}

function formatDateForApi(date: Date): string {
  return date.toISOString().split("T")[0];
}

function computeStreak(events: CalendarEvent[]): number {
  if (events.length === 0) return 0;

  const scheduledByDay = new Map<string, number>();
  const completedByDay = new Map<string, number>();

  events.forEach((e) => {
    const day = new Date(e.date).toISOString().split("T")[0];
    scheduledByDay.set(day, (scheduledByDay.get(day) || 0) + 1);
  });
  events
    .filter((e) => e.status === "completed")
    .forEach((e) => {
      const day = new Date(e.date).toISOString().split("T")[0];
      completedByDay.set(day, (completedByDay.get(day) || 0) + 1);
    });

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dayKey = formatDateForApi(date);

    const total = scheduledByDay.get(dayKey) || 0;
    const completed = completedByDay.get(dayKey) || 0;
    const dayEligible = total > 0 && completed >= Math.min(3, total);

    if (i === 0 && !dayEligible) {
      continue;
    }

    if (dayEligible) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  return streak;
}

function computeWeeklyCompleted(events: CalendarEvent[]): number {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diffToMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday);
  monday.setHours(0, 0, 0, 0);

  return events.filter((e) => {
    const eventDate = new Date(e.date);
    return e.status === "completed" && eventDate >= monday;
  }).length;
}

function countEvents(events: CalendarEvent[], type: string): number {
  return events.filter((e) => e.type === type).length;
}

function countCompletedEvents(events: CalendarEvent[], type: string): number {
  return events.filter((e) => e.type === type && e.status === "completed").length;
}

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, fullName } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [recentEvents, setRecentEvents] = useState<CalendarEvent[]>([]);
  const [plan, setPlan] = useState<any>(null);
  const [planStatus, setPlanStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [logSummary, setLogSummary] = useState<DailyLogResult | null>(null);
  const [hasSubmittedLog, setHasSubmittedLog] = useState(false);

  const today = useMemo(() => new Date(), []);
  const todayStart = useMemo(() => {
    const d = new Date(today);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [today]);
  const todayEnd = useMemo(() => {
    const d = new Date(today);
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  }, [today]);

  const recentStart = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 30);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [today]);

  useEffect(() => {
    const load = async () => {
      try {
        const [eventsData, recentData, planData, statusData, logStatusData] = await Promise.all([
          apiGet<{ events: CalendarEvent[] }>(
            `/calendar/?start=${encodeURIComponent(todayStart)}&end=${encodeURIComponent(todayEnd)}`
          ),
          apiGet<{ events: CalendarEvent[] }>(
            `/calendar/?start=${encodeURIComponent(recentStart)}&end=${encodeURIComponent(todayEnd)}`
          ),
          apiGet<{ plan: any }>("/plan/current"),
          apiGet<{ plan: any; needs_regeneration: boolean }>("/plan/status"),
          apiGet<{
            submitted: boolean;
            parsed: any;
            message: string;
            status: "on_target" | "under" | "over" | null;
            calorie_target: number | null;
            calories_consumed: number | null;
            updated_events: any[];
          }>("/log/today-status"),
        ]);
        setEvents(eventsData.events || []);
        setRecentEvents(recentData.events || []);
        setPlan(planData.plan || null);
        setPlanStatus(statusData.plan || null);

        // Restore end-of-day log state on reload (locks form + repopulates Daily Progress)
        if (logStatusData.submitted && logStatusData.parsed) {
          setLogSummary({
            parsed: logStatusData.parsed,
            calories_consumed: logStatusData.calories_consumed,
            calorie_target: logStatusData.calorie_target,
            status: logStatusData.status || "on_target",
            message: logStatusData.message,
            updated_events: logStatusData.updated_events,
          });
          setHasSubmittedLog(true);
        }

        // Lazy weekly regeneration: if the user rolled into a new week,
        // generate the current week's events and refresh the dashboard.
        if (statusData.needs_regeneration && planData.plan) {
          await apiPost("/plan/regenerate-week", {});
          const refreshedEvents = await apiGet<{ events: CalendarEvent[] }>(
            `/calendar/?start=${encodeURIComponent(todayStart)}&end=${encodeURIComponent(todayEnd)}`
          );
          setEvents(refreshedEvents.events || []);
          const refreshedStatus = await apiGet<{ plan: any; needs_regeneration: boolean }>("/plan/status");
          setPlanStatus(refreshedStatus.plan || null);
        }

        if (searchParams.get("welcome") === "true" && planData.plan) {
          setShowWelcome(true);
          window.history.replaceState({}, "", "/dashboard");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [todayStart, todayEnd, recentStart, searchParams]);

  const streakDays = useMemo(() => computeStreak(recentEvents), [recentEvents]);
  const weeklyCompleted = useMemo(() => computeWeeklyCompleted(recentEvents), [recentEvents]);

  // Meal-based progress (approximate macros/calories from completed meals)
  const totalMeals = countEvents(events, "meal");
  const completedMeals = countCompletedEvents(events, "meal");
  const mealRatio = totalMeals > 0 ? completedMeals / totalMeals : 0;

  // Hydration progress
  const totalHydration = countEvents(events, "hydration");
  const completedHydration = countCompletedEvents(events, "hydration");
  const hydrationRatio = totalHydration > 0 ? completedHydration / totalHydration : 0;

  // Sleep progress
  const completedSleep = countCompletedEvents(events, "sleep");

  // Workout progress (weekly)
  const completedWorkoutsThisWeek = countCompletedEvents(recentEvents, "workout");

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!plan) {
    return (
      <div className="flex h-full flex-col items-center justify-center space-y-4">
        <h2 className="text-2xl font-bold">No active plan yet</h2>
        <p className="text-muted-foreground">
          Complete onboarding to generate your personalized journey.
        </p>
        <Button onClick={() => router.push("/onboarding")}>Start Onboarding</Button>
      </div>
    );
  }

  const final = plan.final_recommendation;
  const macros = final.macros || {};

  // Actual logged values — use parsed log totals when available, fall back to proxy when no log submitted today
  const parsed = logSummary?.parsed;

  const calCurrent = parsed?.total_calories_consumed != null
    ? parsed.total_calories_consumed
    : Math.round(final.calorie_target * mealRatio);
  const proteinCurrent = parsed?.total_grams_protein != null
    ? parsed.total_grams_protein
    : Math.round((macros.protein_g ?? 0) * mealRatio);
  const carbsCurrent = parsed?.total_grams_carbs != null
    ? parsed.total_grams_carbs
    : Math.round((macros.carbs_g ?? 0) * mealRatio);
  const fatCurrent = parsed?.total_grams_fat != null
    ? parsed.total_grams_fat
    : Math.round((macros.fat_g ?? 0) * mealRatio);
  const fiberCurrent = parsed?.total_grams_fiber != null
    ? parsed.total_grams_fiber
    : Math.round((macros.fiber_g ?? 0) * mealRatio);
  const hydrationCurrent = parsed?.total_liters_water != null
    ? Math.round(parsed.total_liters_water * 10) / 10
    : Math.round(final.hydration_liters * hydrationRatio * 10) / 10;
  // Sleep: bedtime log is an INTENT, not actual sleep. Don't count intent as hours.
  const sleepLogged = parsed ? parsed.entries.some((e) => e.type === "sleep") : false;
  const sleepCurrent = 0;
  const sleepNote = sleepLogged
    ? "Sleep intent logged — confirm actual hours tomorrow"
    : (completedSleep > 0 ? "Last confirmed sleep" : "No sleep log yet");
  // Workouts: pure weekly metric (not affected by today's parsed log count)
  const workoutCurrent = completedWorkoutsThisWeek;

  const targetDate = planStatus?.target_date
    ? new Date(planStatus.target_date).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-6">
      <Greeting fullName={fullName} />

      {planStatus && (
        <Card className="border-brandDark/10 bg-white">
          <CardContent className="space-y-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Current phase</p>
                <p className="text-lg font-semibold text-brandDark capitalize">
                  {planStatus.current_phase || "—"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Week</p>
                <p className="text-lg font-semibold text-brandDark">
                  {planStatus.current_week || 1} / {planStatus.target_duration_weeks || 12}
                </p>
              </div>
              {targetDate && (
                <div>
                  <p className="text-sm text-muted-foreground">Goal date</p>
                  <p className="text-lg font-semibold text-brandDark">{targetDate}</p>
                </div>
              )}
            </div>

            {planStatus.phases && planStatus.phases.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-brandDark">Journey phases</p>
                <div className="relative flex items-start gap-2">
                  {planStatus.phases.map((phase: any, idx: number) => {
                    const isCurrent =
                      phase.week_start <= (planStatus.current_week || 1) &&
                      phase.week_end >= (planStatus.current_week || 1);
                    const isPast = phase.week_end < (planStatus.current_week || 1);
                    return (
                      <div key={idx} className="flex-1">
                        <div
                          className={`h-2 rounded-full ${
                            isCurrent
                              ? "bg-lightGreen"
                              : isPast
                              ? "bg-brandDark/30"
                              : "bg-brandDark/10"
                          }`}
                        />
                        <div className="mt-2 text-xs">
                          <p
                            className={`font-medium capitalize ${
                              isCurrent ? "text-brandDark" : "text-muted-foreground"
                            }`}
                          >
                            {phase.name}
                          </p>
                          <p className="text-muted-foreground">
                            W{phase.week_start}-{phase.week_end}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <StreakCard streakDays={streakDays} weeklyCompleted={weeklyCompleted} />

      <div>
        <h2 className="mb-3 text-lg font-semibold text-brandDark">Your Daily Progress</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetricProgress
            icon={Flame}
            label="Calories"
            current={calCurrent}
            target={final.calorie_target}
            unit="kcal"
            color="amber"
            note={totalMeals === 0 ? "No meals scheduled today" : `${completedMeals} of ${totalMeals} meals logged`}
          />
          <MetricProgress
            icon={Beef}
            label="Protein"
            current={proteinCurrent}
            target={macros.protein_g ?? 0}
            unit="g"
            color="red"
          />
          <MetricProgress
            icon={Wheat}
            label="Carbs"
            current={carbsCurrent}
            target={macros.carbs_g ?? 0}
            unit="g"
            color="amber"
          />
          <MetricProgress
            icon={Droplet}
            label="Fat"
            current={fatCurrent}
            target={macros.fat_g ?? 0}
            unit="g"
            color="purple"
          />
          <MetricProgress
            icon={Scale}
            label="Fiber"
            current={fiberCurrent}
            target={macros.fiber_g ?? 0}
            unit="g"
            color="green"
          />
          <MetricProgress
            icon={Dumbbell}
            label="Workouts"
            current={workoutCurrent}
            target={final.weekly_workouts}
            unit="sessions"
            color="blue"
            note="This week's progress"
          />
          <MetricProgress
            icon={Droplets}
            label="Hydration"
            current={hydrationCurrent}
            target={final.hydration_liters}
            unit="L"
            color="cyan"
            note={totalHydration === 0 ? "No hydration reminders today" : `${completedHydration} of ${totalHydration} completed`}
          />
          <MetricProgress
            icon={Moon}
            label="Sleep"
            current={sleepCurrent}
            target={final.sleep_hours_target}
            unit="hrs"
            color="indigo"
            note={sleepNote}
          />
          <MetricProgress
            icon={Footprints}
            label="Daily Steps"
            current={0}
            target={final.daily_steps_goal ?? 0}
            unit="steps"
            color="green"
            note="Future feature: Connect a fitness tracker for real step data"
          />
        </div>
      </div>

      <QuickActions />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarDays className="h-5 w-5" />
            Today&apos;s Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {events.length === 0 ? (
            <p className="text-muted-foreground">No events scheduled for today.</p>
          ) : (
            events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))
          )}

          {logSummary && (
            <div className="rounded-lg border border-lightGreen bg-lightGreen/10 p-4">
              <p className="font-medium text-brandDark">Bodi&apos;s Summary</p>
              <p className="text-sm text-brandDark/80">{logSummary.message}</p>
              {logSummary.calories_consumed !== null && logSummary.calorie_target !== null && (
                <p className="mt-1 text-sm font-medium text-brandDark">
                  {logSummary.calories_consumed} / {logSummary.calorie_target} kcal
                  <span
                    className={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs ${
                      logSummary.status === "on_target"
                        ? "bg-green-100 text-green-700"
                        : logSummary.status === "under"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {logSummary.status === "on_target"
                      ? "On target"
                      : logSummary.status === "under"
                      ? "Under"
                      : "Over"}
                  </span>
                </p>
              )}
            </div>
          )}

          <div className="border-t pt-4">
            <p className="mb-2 text-sm font-medium text-brandDark">End-of-day log</p>
            <p className="mb-3 text-xs text-muted-foreground">
              Use this at the end of the day to tell Bodi what you actually did.
            </p>
            <DailyLog
              disabled={hasSubmittedLog}
              onLogSubmitted={async (result) => {
                setLogSummary(result);
                setHasSubmittedLog(true);
                // Use updated_events from response to refresh today's schedule immediately
                const updated = (result.updated_events || []).map((e: any) => ({
                  id: e.id,
                  date: e.date,
                  type: e.type,
                  title: e.title,
                  status: e.status,
                }));
                setEvents(updated);
                // Refetch 30-day calendar window so weekly workout count reflects the just-completed workout
                const recentRefreshed = await apiGet<{ events: CalendarEvent[] }>(
                  `/calendar/?start=${encodeURIComponent(recentStart)}&end=${encodeURIComponent(todayEnd)}`
                );
                setRecentEvents(recentRefreshed.events || []);
              }}
            />
          </div>
        </CardContent>
      </Card>

      <WelcomeModal open={showWelcome} onOpenChange={setShowWelcome} plan={plan} />
    </div>
  );
}
