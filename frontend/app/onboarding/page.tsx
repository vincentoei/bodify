"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { apiPost, apiGet, apiStream } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import { Loader2, Brain, ArrowLeft, CheckCircle, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { ChatBubble } from "@/components/onboarding/chat-bubble";
import { FormCard } from "@/components/onboarding/form-card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getAgentByName } from "@/lib/agents";

const GOAL_OPTIONS = [
  "Lose fat",
  "Build muscle",
  "Gain healthy weight",
  "Maintain health",
  "Improve energy",
];

const PREDEFINED_CONDITIONS = [
  "Diabetes",
  "Hypertension",
  "PCOS",
  "Thyroid issues",
  "Heart disease",
  "Obesity",
];

const DIET_OPTIONS = [
  "Omnivore",
  "Vegetarian",
  "Vegan",
  "Pescatarian",
  "Halal",
  "Kosher",
  "Gluten-free",
  "Dairy-free",
];

const CUISINE_OPTIONS = [
  "Mediterranean",
  "Asian",
  "Mexican",
  "Indian",
  "Italian",
  "Middle Eastern",
  "American",
];

const TOTAL_STEPS = 5;

const STEP_NAMES = [
  "YOUR GOALS",
  "YOUR BODY",
  "MEDICAL & SAFETY",
  "LIFESTYLE",
  "MINDSET",
];

const WELCOME_MESSAGE = "Hi! I'm Bodi, your personal companion in Bodify. Let's build a plan that actually fits your life.";

const STEP_QUESTIONS = [
  "First, what do you want to achieve?",
  "Great. Now a bit about your body.",
  "Any medical conditions or allergies I should know about?",
  "How does your lifestyle look?",
  "Lastly, your mindset matters.",
];

function getReassuranceMessage(stepIndex: number, form: OnboardingForm): string {
  switch (stepIndex) {
    case 0:
      return `Got it — ${form.primaryGoal || form.goals[0] || "improve health"} it is. That's a solid, achievable target.`;
    case 1:
      return `Thanks! At ${form.age || "30"} years old and ${form.weightKg || "70"}kg, I have a good baseline to work with.`;
    case 2:
      return "Noted. I'll make sure your plan respects all of that.";
    case 3:
      return `Perfect — ${form.dietPattern} with your favorite cuisines. I'll keep it realistic.`;
    case 4:
      return "I love that you're here. Let's build something that actually sticks this time.";
    default:
      return "Got it.";
  }
}

interface OnboardingForm {
  goals: string[];
  primaryGoal: string;
  age: string;
  sex: string;
  heightCm: string;
  weightKg: string;
  activityLevel: string;
  occupation: string;
  conditions: string[];
  allergies: string;
  medications: string;
  injuries: string;
  pregnancy: boolean;
  dietPattern: string;
  cuisines: string[];
  cookingAbility: string;
  kitchenAccess: string;
  budgetLevel: string;
  workSchedule: string;
  sleepHours: string;
  stressLevel: string;
  socialEating: string;
  pastAttempts: string;
  motivationStyle: string;
  restrictionTolerance: string;
  setbacksHistory: string;
  whyNow: string;
}

function AgentMessageBubble({ rationale }: { rationale: string }) {
  const [expanded, setExpanded] = useState(false);
  const previewLength = 180;
  const isLong = rationale.length > previewLength;
  const preview = isLong ? rationale.slice(0, previewLength).trim() + "..." : rationale;

  return (
    <div>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">
        {expanded ? rationale : preview}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs font-medium opacity-70 hover:opacity-100 underline underline-offset-2"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isLoading, isDemo } = useAuth();
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const [activeStep, setActiveStep] = useState(1);
  const [visibleSteps, setVisibleSteps] = useState<number[]>([1]);
  const [thinkingForStep, setThinkingForStep] = useState<number | null>(null);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [deliberating, setDeliberating] = useState(false);
  const [streamedAgents, setStreamedAgents] = useState<any[]>([]);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [resolutionSummary, setResolutionSummary] = useState("");
  const [coordinatorDone, setCoordinatorDone] = useState(false);
  const [totalAgents, setTotalAgents] = useState(0);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [otherCondition, setOtherCondition] = useState("");
  const [checkingPlan, setCheckingPlan] = useState(true);
  const deliberationScrollRef = useRef<HTMLDivElement>(null);
  const deliberationBottomRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<OnboardingForm>({
    goals: [],
    primaryGoal: "",
    age: "",
    sex: "female",
    heightCm: "",
    weightKg: "",
    activityLevel: "lightly_active",
    occupation: "",
    conditions: [],
    allergies: "",
    medications: "",
    injuries: "",
    pregnancy: false,
    dietPattern: "Omnivore",
    cuisines: [],
    cookingAbility: "basic",
    kitchenAccess: "full",
    budgetLevel: "medium",
    workSchedule: "",
    sleepHours: "7",
    stressLevel: "medium",
    socialEating: "sometimes",
    pastAttempts: "",
    motivationStyle: "supportive",
    restrictionTolerance: "medium",
    setbacksHistory: "",
    whyNow: "",
  });

  useEffect(() => {
    if (!isLoading && !user && !isDemo) {
      router.push("/signin");
      setCheckingPlan(false);
      return;
    }

    if (!isLoading && (user || isDemo)) {
      apiGet<{ plan: unknown }>("/plan/current")
        .then((data) => {
          if (data.plan) {
            // User already has a plan — redirect and keep loading spinner
            // until navigation completes to avoid a flash of the onboarding UI.
            router.push("/");
          } else {
            // No plan exists yet; reveal the onboarding form.
            setCheckingPlan(false);
          }
        })
        .catch(() => {
          // No plan exists yet or request failed; stay on onboarding.
          setCheckingPlan(false);
        });
    }
  }, [user, isLoading, isDemo, router]);

  // Reset pregnancy if sex is changed away from female
  useEffect(() => {
    if (form.sex !== "female" && form.pregnancy) {
      setForm((prev) => ({ ...prev, pregnancy: false }));
    }
  }, [form.sex, form.pregnancy]);

  // Auto-scroll deliberation chat log when new agents/conflicts arrive
  useEffect(() => {
    const timer = setTimeout(() => {
      deliberationBottomRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [streamedAgents, conflicts, coordinatorDone]);

  const toggleGoal = (goal: string) => {
    setForm((prev) => {
      const goals = prev.goals.includes(goal)
        ? prev.goals.filter((g) => g !== goal)
        : [...prev.goals, goal];
      return { ...prev, goals };
    });
  };

  const toggleCuisine = (cuisine: string) => {
    setForm((prev) => {
      const cuisines = prev.cuisines.includes(cuisine)
        ? prev.cuisines.filter((c) => c !== cuisine)
        : [...prev.cuisines, cuisine];
      return { ...prev, cuisines };
    });
  };

  const toggleCondition = (condition: string) => {
    setForm((prev) => {
      const conditions = prev.conditions.includes(condition)
        ? prev.conditions.filter((c) => c !== condition)
        : [...prev.conditions, condition];
      return { ...prev, conditions };
    });
  };

  const handleAddOtherCondition = () => {
    const trimmed = otherCondition.trim();
    if (!trimmed) return;

    // Check case-insensitive match against predefined conditions
    const matched = PREDEFINED_CONDITIONS.find(
      (c) => c.toLowerCase() === trimmed.toLowerCase()
    );

    if (matched) {
      toggleCondition(matched);
    } else {
      setForm((prev) => {
        if (prev.conditions.includes(trimmed)) return prev;
        return { ...prev, conditions: [...prev.conditions, trimmed] };
      });
    }

    setOtherCondition("");
  };

  const isStepValid = (step: number): boolean => {
    switch (step) {
      case 1:
        return form.goals.length > 0 && form.primaryGoal.trim().length > 0;
      case 2:
        return (
          !!form.age &&
          !!form.sex &&
          !!form.heightCm &&
          !!form.weightKg
        );
      case 3:
        return true; // all optional
      case 4:
        return !!form.dietPattern;
      case 5:
        return true; // all optional
      default:
        return false;
    }
  };

  const handleNext = (currentStep: number) => {
    if (currentStep >= TOTAL_STEPS) return;

    // Mark current step as completed
    setCompletedSteps((prev) => [...prev, currentStep]);

    // Show thinking indicator
    setThinkingForStep(currentStep);

    // After 1 second of thinking, show reassurance and move to next step
    setTimeout(() => {
      setThinkingForStep(null);

      // Show next step question and form after a short delay
      setTimeout(() => {
        const nextStep = currentStep + 1;
        setVisibleSteps((prev) => [...prev, nextStep]);
        setActiveStep(nextStep);

        // Auto-scroll to the absolute bottom after new content is painted
        setTimeout(() => {
          document
            .getElementById("onboarding-scroll-anchor")
            ?.scrollIntoView({ behavior: "smooth", block: "end" });
        }, 100);
      }, 800);
    }, 1000);
  };

  const handleExit = () => {
    router.push("/");
  };

  const handleSubmit = async () => {
    // Validate all required steps before submitting
    for (let step = 1; step <= TOTAL_STEPS; step++) {
      if (!isStepValid(step)) {
        alert(`Please complete step ${step} before creating your plan.`);
        return;
      }
    }

    setLoading(true);
    setDeliberating(true);
    setStreamedAgents([]);
    setConflicts([]);
    setResolutionSummary("");
    setCoordinatorDone(false);
    setTotalAgents(0);
    try {
      const profile = {
        goals: form.goals,
        primary_goal: form.primaryGoal || form.goals[0] || "Improve health",
        body: {
          age: parseInt(form.age) || 30,
          sex: form.sex,
          height_cm: parseFloat(form.heightCm) || 170,
          weight_kg: parseFloat(form.weightKg) || 70,
          activity_level: form.activityLevel,
          occupation: form.occupation,
        },
        medical: {
          conditions: form.conditions,
          allergies: form.allergies.split(",").map((s) => s.trim()).filter(Boolean),
          medications: form.medications.split(",").map((s) => s.trim()).filter(Boolean),
          injuries: form.injuries.split(",").map((s) => s.trim()).filter(Boolean),
          pregnancy: form.pregnancy,
        },
        lifestyle: {
          diet_pattern: form.dietPattern,
          cuisines: form.cuisines,
          cooking_ability: form.cookingAbility,
          kitchen_access: form.kitchenAccess,
          budget_level: form.budgetLevel,
          work_schedule: form.workSchedule,
          sleep_hours: parseFloat(form.sleepHours) || 7,
          stress_level: form.stressLevel,
          social_eating: form.socialEating,
        },
        psychology: {
          past_attempts: form.pastAttempts.split(",").map((s) => s.trim()).filter(Boolean),
          motivation_style: form.motivationStyle,
          restriction_tolerance: form.restrictionTolerance,
          setbacks_history: form.setbacksHistory.split(",").map((s) => s.trim()).filter(Boolean),
          why_now: form.whyNow,
        },
      };

      await apiPost("/onboarding/profile", profile);

      // Stream agent deliberation in real-time, passing the user's timezone
      // so meal and workout times are generated correctly.
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      await apiStream(
        `/plan/generate-stream?timezone=${encodeURIComponent(timezone)}`,
        {},
        (event, data) => {
        if (event === "start") {
          setTotalAgents(data.total_agents);
        }
        if (event === "agent") {
          setStreamedAgents((prev) => [...prev, data]);
        }
        if (event === "coordinator") {
          setConflicts(data.conflicts || []);
          setResolutionSummary(data.resolution_summary || "");
          setCoordinatorDone(true);
        }
        if (event === "done") {
          // Scroll to bottom to show consensus before redirect
          deliberationBottomRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "end",
          });
          // Brief cinematic pause, then redirect to dashboard with welcome flag
          setTimeout(() => {
            router.push("/dashboard?welcome=true");
          }, 2000);
        }
        if (event === "error") {
          alert(data.error || "Failed to create your plan. Please try again.");
          setDeliberating(false);
        }
      });
    } catch (err: any) {
      alert(err.message || "Failed to create your plan. Please try again.");
      setDeliberating(false);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading || checkingPlan || (!user && !isDemo)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (deliberating) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-8">
        <div className="w-full max-w-2xl bg-white rounded-xl border shadow-sm p-6 flex flex-col h-[80vh]">
          <div className="text-center mb-4 shrink-0">
            <h2 className="text-2xl font-semibold mb-1">Agent Council in Session</h2>
            <p className="text-sm text-muted-foreground">
              Your specialists are debating the safest, most realistic plan for your body and life.
            </p>
          </div>

          {/* Chat log — scrollable area */}
          <div ref={deliberationScrollRef} className="flex-1 overflow-y-auto space-y-3 pr-1">
            {streamedAgents.map((agent) => {
              const agentConfig = getAgentByName(agent.agent_name);
              const Icon = agentConfig?.icon || Brain;
              const iconBg = agentConfig?.bgColor || "bg-zinc-50";
              const iconColor = agentConfig?.iconColor || "text-zinc-700";
              const bubbleColor = agentConfig
                ? `${agentConfig.color} ${agentConfig.iconColor} border-current`
                : "bg-zinc-100 text-zinc-700 border-zinc-200";
              return (
                <motion.div
                  key={agent.agent_name}
                  className="flex items-start gap-3"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <div className={`shrink-0 rounded-full ${iconBg} ${iconColor} p-2 border`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className={`flex-1 rounded-2xl rounded-tl-md border px-4 py-3 ${bubbleColor}`}>
                    <p className="text-xs font-semibold opacity-80 mb-1">{agent.agent_name}</p>
                    <AgentMessageBubble rationale={agent.rationale || ""} />
                  </div>
                </motion.div>
              );
            })}

            {/* Conflict system notices */}
            {conflicts.map((conflict, idx) => (
              <motion.div
                key={`conflict-${idx}`}
                className="flex justify-center"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700">
                  <AlertTriangle className="h-3 w-3" />
                  <span className="font-medium">Conflict detected:</span>
                  <span>{conflict.topic}</span>
                </div>
              </motion.div>
            ))}

            {/* Bodi coordinator consensus */}
            {coordinatorDone && (
              <motion.div
                className="flex items-start gap-3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <div className="shrink-0 rounded-full bg-green-50 p-2 border border-green-200">
                  <Brain className="h-4 w-4 text-green-600" />
                </div>
                <div className="flex-1 rounded-2xl rounded-tl-md border border-green-200 bg-green-50 px-4 py-3 text-green-800">
                  <p className="text-xs font-semibold opacity-80 mb-1">Bodi (Coordinator)</p>
                  <p className="text-sm">
                    I&apos;ve finished making your plan decision based on the 5 specialists&apos; opinions. Taking you to your dashboard now...
                  </p>
                </div>
              </motion.div>
            )}

            {/* Typing indicator while waiting */}
            {totalAgents > 0 && streamedAgents.length < totalAgents && !coordinatorDone && (
              <div className="flex items-center gap-2 px-2 py-1">
                <div className="flex gap-1">
                  <span className="h-2 w-2 rounded-full bg-zinc-300 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 rounded-full bg-zinc-300 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-2 w-2 rounded-full bg-zinc-300 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <span className="text-xs text-zinc-400">
                  {streamedAgents.length === totalAgents
                    ? "Bodi is synthesizing..."
                    : `Waiting for ${totalAgents - streamedAgents.length} more specialist${totalAgents - streamedAgents.length > 1 ? "s" : ""}...`}
                </span>
              </div>
            )}
            {/* Scroll anchor — ensures auto-scroll reaches absolute bottom */}
            <div ref={deliberationBottomRef} className="h-1" />
          </div>

          {/* Footer status */}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-4 shrink-0">
            {coordinatorDone ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-green-600 font-medium">
                  Bodi has reached consensus
                </span>
              </>
            ) : (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Specialists are debating...</span>
              </>
            )}
          </div>
        </div>
      </main>
    );
  }

  const renderStepForm = (step: number) => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <Label>
                Select all that apply{" "}
                <span className="text-destructive">*</span>
              </Label>
              <div className="flex flex-wrap gap-2">
                {GOAL_OPTIONS.map((goal) => (
                  <Badge
                    key={goal}
                    variant={form.goals.includes(goal) ? "default" : "outline"}
                    className="cursor-pointer px-3 py-2 text-sm"
                    onClick={() => toggleGoal(goal)}
                  >
                    {goal}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="primary-goal">
                Primary goal{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="primary-goal"
                placeholder="e.g., Lose 10 kg sustainably"
                value={form.primaryGoal}
                onChange={(e) => setForm({ ...form, primaryGoal: e.target.value })}
              />
            </div>
          </div>
        );
      case 2:
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="age">
                Age{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input id="age" type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sex">
                Sex{" "}
                <span className="text-destructive">*</span>
              </Label>
              <select
                id="sex"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.sex}
                onChange={(e) => setForm({ ...form, sex: e.target.value })}
              >
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Prefer not to say</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="height">
                Height (cm){" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input id="height" type="number" value={form.heightCm} onChange={(e) => setForm({ ...form, heightCm: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weight">
                Weight (kg){" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input id="weight" type="number" value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: e.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="activity">Activity Level</Label>
              <select
                id="activity"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.activityLevel}
                onChange={(e) => setForm({ ...form, activityLevel: e.target.value })}
              >
                <option value="sedentary">Sedentary</option>
                <option value="lightly_active">Lightly active</option>
                <option value="moderately_active">Moderately active</option>
                <option value="very_active">Very active</option>
                <option value="super_active">Super active</option>
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="occupation">Occupation / Daily routine</Label>
              <Input id="occupation" value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })} />
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <Label>Health conditions</Label>
              <div className="flex flex-wrap gap-2">
                {PREDEFINED_CONDITIONS.map((c) => (
                  <Badge
                    key={c}
                    variant={form.conditions.includes(c) ? "default" : "outline"}
                    className="cursor-pointer px-3 py-2 text-sm"
                    onClick={() => toggleCondition(c)}
                  >
                    {c}
                  </Badge>
                ))}
                {form.conditions
                  .filter((c) => !PREDEFINED_CONDITIONS.includes(c))
                  .map((c) => (
                    <Badge
                      key={c}
                      variant="default"
                      className="cursor-pointer px-3 py-2 text-sm"
                      onClick={() => toggleCondition(c)}
                    >
                      {c}
                    </Badge>
                  ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Other condition (type and press Enter)"
                  value={otherCondition}
                  onChange={(e) => setOtherCondition(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddOtherCondition();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={handleAddOtherCondition}>
                  Add
                </Button>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="allergies">Allergies (comma separated)</Label>
                <Input id="allergies" value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="medications">Medications (comma separated)</Label>
                <Input id="medications" value={form.medications} onChange={(e) => setForm({ ...form, medications: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="injuries">Injuries / limitations</Label>
              <Input id="injuries" value={form.injuries} onChange={(e) => setForm({ ...form, injuries: e.target.value })} />
            </div>
            {form.sex === "female" && (
              <div className="flex items-center gap-2">
                <input
                  id="pregnancy"
                  type="checkbox"
                  checked={form.pregnancy}
                  onChange={(e) => setForm({ ...form, pregnancy: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="pregnancy">Currently pregnant</Label>
              </div>
            )}
          </div>
        );
      case 4:
        return (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="diet">
                  Diet pattern{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <select
                  id="diet"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.dietPattern}
                  onChange={(e) => setForm({ ...form, dietPattern: e.target.value })}
                >
                  {DIET_OPTIONS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget">Budget level</Label>
                <select
                  id="budget"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.budgetLevel}
                  onChange={(e) => setForm({ ...form, budgetLevel: e.target.value })}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <div className="space-y-3">
              <Label>Favorite cuisines</Label>
              <div className="flex flex-wrap gap-2">
                {CUISINE_OPTIONS.map((c) => (
                  <Badge
                    key={c}
                    variant={form.cuisines.includes(c) ? "default" : "outline"}
                    className="cursor-pointer px-3 py-2 text-sm"
                    onClick={() => toggleCuisine(c)}
                  >
                    {c}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cooking">Cooking ability</Label>
                <select
                  id="cooking"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.cookingAbility}
                  onChange={(e) => setForm({ ...form, cookingAbility: e.target.value })}
                >
                  <option value="none">None</option>
                  <option value="basic">Basic</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="kitchen">Kitchen access</Label>
                <select
                  id="kitchen"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.kitchenAccess}
                  onChange={(e) => setForm({ ...form, kitchenAccess: e.target.value })}
                >
                  <option value="minimal">Minimal</option>
                  <option value="basic">Basic</option>
                  <option value="full">Full</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule">Typical work / daily schedule</Label>
              <Input id="schedule" placeholder="e.g., 9am-6pm office, commute 1hr" value={form.workSchedule} onChange={(e) => setForm({ ...form, workSchedule: e.target.value })} />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="sleep">Sleep hours</Label>
                <Input id="sleep" type="number" value={form.sleepHours} onChange={(e) => setForm({ ...form, sleepHours: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stress">Stress level</Label>
                <select
                  id="stress"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.stressLevel}
                  onChange={(e) => setForm({ ...form, stressLevel: e.target.value })}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="social">Social eating</Label>
                <select
                  id="social"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.socialEating}
                  onChange={(e) => setForm({ ...form, socialEating: e.target.value })}
                >
                  <option value="rarely">Rarely</option>
                  <option value="sometimes">Sometimes</option>
                  <option value="often">Often</option>
                </select>
              </div>
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="motivation">Motivation style</Label>
                <select
                  id="motivation"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.motivationStyle}
                  onChange={(e) => setForm({ ...form, motivationStyle: e.target.value })}
                >
                  <option value="data_driven">Data-driven</option>
                  <option value="supportive">Supportive</option>
                  <option value="competitive">Competitive</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tolerance">Tolerance for restriction</Label>
                <select
                  id="tolerance"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.restrictionTolerance}
                  onChange={(e) => setForm({ ...form, restrictionTolerance: e.target.value })}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="attempts">Past attempts (comma separated)</Label>
              <Input id="attempts" placeholder="e.g., keto, intermittent fasting" value={form.pastAttempts} onChange={(e) => setForm({ ...form, pastAttempts: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="setbacks">Common setbacks</Label>
              <Input id="setbacks" placeholder="e.g., stress eating, travel" value={form.setbacksHistory} onChange={(e) => setForm({ ...form, setbacksHistory: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="why">Why now?</Label>
              <Textarea id="why" placeholder="What motivated you to start today?" value={form.whyNow} onChange={(e) => setForm({ ...form, whyNow: e.target.value })} />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <main className="flex min-h-screen bg-zinc-50">
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-4 py-8 md:px-8"
      >
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Exit button */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0 }}
            onClick={() => setShowExitDialog(true)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Exit
          </motion.button>

          {/* Header */}
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0 }}
            className="text-4xl sm:text-4xl lg:text-5xl font-bold leading-tight tracking-tight mb-8"
          >
            Let&apos;s build your plan
          </motion.h1>

          {/* Welcome message */}
          <ChatBubble message={WELCOME_MESSAGE} delay={300} />

          {/* Render each visible step */}
          {visibleSteps.map((step) => (
            <div key={step} className="space-y-4">
              {/* Question message */}
              <ChatBubble message={STEP_QUESTIONS[step - 1]} delay={step === 1 ? 600 : 0} />

              {/* Form card */}
              <FormCard
                stepNumber={step}
                totalSteps={TOTAL_STEPS}
                stepName={STEP_NAMES[step - 1]}
                isReadOnly={completedSteps.includes(step)}
                isLastStep={step === TOTAL_STEPS}
                loading={step === TOTAL_STEPS ? loading : false}
                onNext={() => handleNext(step)}
                onSubmit={handleSubmit}
                delay={step === 1 ? 1000 : 400}
                canAdvance={isStepValid(step)}
              >
                {renderStepForm(step)}
              </FormCard>

              {/* Thinking indicator after this step if it's completed */}
              {thinkingForStep === step && (
                <ChatBubble isThinking delay={0} />
              )}

              {/* Reassurance message after this step if completed */}
              {completedSteps.includes(step) && thinkingForStep !== step && (
                <ChatBubble
                  message={getReassuranceMessage(step - 1, form)}
                  delay={200}
                />
              )}
            </div>
          ))}
          {/* Scroll anchor — ensures auto-scroll reaches absolute bottom */}
          <div id="onboarding-scroll-anchor" className="h-1" />
        </div>
      </div>

      {/* Exit confirmation dialog */}
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exit onboarding?</DialogTitle>
            <DialogDescription>
              You&apos;ll lose all your progress and return to the home page.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
            <Button variant="outline" onClick={() => setShowExitDialog(false)}>
              Stay
            </Button>
            <Button variant="destructive" onClick={handleExit}>
              Exit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
