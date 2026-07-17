"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiGet, apiFetch, apiStream } from "@/lib/api";
import { getAgentByName } from "@/lib/agents";
import { Loader2, Mic, Send, AlertTriangle, Activity, Utensils, Leaf, Zap } from "lucide-react";

const ICONS: Record<string, React.ElementType> = {
  Activity,
  Utensils,
  Leaf,
  Zap,
};

interface ChatEvent {
  kind: "agent" | "coordinator" | "system";
  agentName?: string;
  role?: string;
  rationale?: string;
  confidence?: number;
  message?: string;
}

interface SimulationSummary {
  impact_summary: string;
  likely_outcome: string;
  risks: string[];
  recommendation_delta: Record<string, number | null> | null;
  specialist_outputs: Array<{
    agent_name: string;
    role: string;
    recommendation: Record<string, unknown>;
    evidence: string;
    confidence: number;
    rationale: string;
  }>;
  conflicts: Array<{ agents: string[]; topic: string; summary: string; trade_off: string }>;
  resolution_summary: string;
}

const DELTA_LABELS: Record<string, string> = {
  calorie_target: "Calories",
  weekly_workouts: "Workouts/week",
  workout_duration_min: "Workout min",
  daily_steps_goal: "Daily steps",
  sleep_hours_target: "Sleep hours",
  hydration_liters: "Water (L)",
};

function formatDelta(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

export default function SimulatePage() {
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [chat, setChat] = useState<ChatEvent[]>([]);
  const [summary, setSummary] = useState<SimulationSummary | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    apiGet<{ scenarios: any[] }>("/simulate/scenarios").then((data) => {
      setScenarios(data.scenarios);
    });
  }, []);

  const startListening = async () => {
    setText("");
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        await transcribe(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };
      mediaRecorder.onerror = () => setIsListening(false);
      mediaRecorder.start();
      setIsListening(true);
    } catch (err: any) {
      alert(err.message || "Could not access microphone.");
    }
  };

  const stopListening = () => {
    mediaRecorderRef.current?.stop();
    setIsListening(false);
  };

  const transcribe = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("file", audioBlob, "recording.webm");
      const res = await apiFetch("/stt/transcribe", { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.text()) || "Transcription failed");
      const data = await res.json();
      setText((prev) => (prev ? prev + " " : "") + (data.transcript || ""));
    } catch (err: any) {
      alert(err.message || "Transcription failed");
    } finally {
      setIsTranscribing(false);
    }
  };

  const runCustom = async () => {
    if (!text.trim()) return;
    setChat([]);
    setSummary(null);
    setStreamError(null);
    setIsSubmitting(true);
    try {
      await apiStream("/simulate/stream", { prompt: text }, (event, data) => {
        if (event === "start") return;
        if (event === "agent") {
          setChat((prev) => [
            ...prev,
            {
              kind: "agent",
              agentName: data.agent_name,
              role: data.role,
              rationale: data.rationale,
              confidence: data.confidence,
            },
          ]);
          return;
        }
        if (event === "coordinator") {
          setSummary(data as SimulationSummary);
          return;
        }
        if (event === "system") {
          setChat((prev) => [...prev, { kind: "system", message: data.message }]);
          return;
        }
        if (event === "done") return;
        if (event === "error") {
          setStreamError(data.error || "Simulation failed");
          return;
        }
      });
    } catch (err: any) {
      setStreamError(err.message || "Failed to run simulation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const busy = isListening || isTranscribing || isSubmitting;
  const delta = summary?.recommendation_delta;
  const deltaEntries = delta
    ? Object.entries(delta).filter(([, v]) => v !== null && v !== undefined)
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">What-If Simulation</h1>
        <p className="text-muted-foreground">Explore scenarios before committing to a change.</p>
      </div>

      {/* Example scenario cards — display-only, clickable to prefill textbox */}
      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Try one of these</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {scenarios.map((scenario) => {
            const Icon = ICONS[scenario.icon] || Activity;
            return (
              <button
                type="button"
                key={scenario.id}
                onClick={() => setText(scenario.description)}
                disabled={busy}
                className={`text-left rounded-xl border p-4 transition-colors hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60 ${scenario.palette || "border-zinc-200 bg-zinc-50 text-zinc-700"}`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5" />
                  <span className="text-sm font-semibold">{scenario.title}</span>
                </div>
                <p className="mt-2 text-sm">{scenario.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom input */}
      <div className="border-t pt-6">
        <h2 className="mb-1 text-lg font-semibold">Ask your own What-If</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Describe a scenario in your own words. The agent council will reason through likely outcomes,
          risks, and any plan shifts.
        </p>

        <div className="rounded-xl border border-brandDark/10 bg-white p-4">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g., What if I move to Japan for a month and can only walk and eat ramen?"
            rows={4}
            disabled={busy}
            className="mb-3 resize-none"
          />
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={isListening ? stopListening : startListening}
              disabled={isTranscribing || isSubmitting}
              className={`shrink-0 ${
                isListening ? "bg-red-50 border-red-300 text-red-600 hover:bg-red-100" : ""
              }`}
              aria-label={isListening ? "Stop recording" : "Start recording"}
            >
              <Mic className="h-4 w-4" />
            </Button>
            <Button
              onClick={runCustom}
              disabled={busy || !text.trim()}
              className="w-full bg-lightGreen text-brandDark hover:bg-lightGreen/90 disabled:cursor-not-allowed"
            >
              {isListening ? (
                "Bodi is listening... Press mic again to stop"
              ) : isTranscribing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Transcribing...
                </>
              ) : isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Simulating...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Run What-If
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Stream error */}
      {streamError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {streamError}
        </div>
      )}

      {/* Live agent bubbles */}
      {chat.length > 0 && (
        <div className="space-y-3">
          {chat.map((evt, idx) => {
            if (evt.kind === "system") {
              return (
                <div key={idx} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  {evt.message}
                </div>
              );
            }
            if (evt.kind === "agent") {
              const agent = evt.agentName ? getAgentByName(evt.agentName) : null;
              return (
                <div
                  key={idx}
                  className={`rounded-xl border p-4 ${agent?.bgColor || "bg-white"} ${agent?.iconColor || "text-zinc-700"}`}
                >
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={agent?.iconColor || ""}>
                      {evt.agentName}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {evt.role} · {Math.round((evt.confidence || 0) * 100)}% confidence
                    </span>
                  </div>
                  <p className="mt-2 text-sm">{evt.rationale}</p>
                </div>
              );
            }
            return null;
          })}
        </div>
      )}

      {/* Custom result */}
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>What-If Outcome</CardTitle>
            <CardDescription>{summary.impact_summary}</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="summary" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="debate">Agent Debate</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="space-y-5 pt-4">
                <div>
                  <h3 className="mb-1 text-sm font-semibold">Likely outcome</h3>
                  <p className="text-sm text-muted-foreground">{summary.likely_outcome}</p>
                </div>

                {summary.risks.length > 0 && (
                  <div>
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      Risks
                    </h3>
                    <ul className="space-y-1">
                      {summary.risks.map((r, i) => (
                        <li key={i} className="text-sm text-muted-foreground">
                          — {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {deltaEntries.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">Recommended adjustments</h3>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {deltaEntries.map(([key, value]) => (
                        <div key={key} className="rounded-lg border p-3">
                          <p className="text-xs text-muted-foreground">
                            {DELTA_LABELS[key] || key}
                          </p>
                          <p className="text-lg font-bold text-primary">{formatDelta(value as number)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-lg bg-muted p-4">
                  <Badge>Bodi Resolution</Badge>
                  <p className="mt-2 text-sm">{summary.resolution_summary}</p>
                </div>
              </TabsContent>

              <TabsContent value="debate" className="space-y-4 pt-4">
                {summary.specialist_outputs.map((specialist, idx) => {
                  const agent = getAgentByName(specialist.agent_name);
                  return (
                    <div
                      key={idx}
                      className={`rounded-xl border p-4 ${agent?.bgColor || "bg-white"} ${agent?.iconColor || "text-zinc-700"}`}
                    >
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className={agent?.iconColor || ""}>
                          {specialist.agent_name}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {specialist.role} · {Math.round((specialist.confidence || 0) * 100)}% confidence
                        </span>
                      </div>
                      <p className="mt-2 text-sm">{specialist.rationale}</p>
                    </div>
                  );
                })}
                {summary.conflicts.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <h4 className="mb-2 text-sm font-semibold text-amber-800">Conflicts surfaced</h4>
                    {summary.conflicts.map((c, i) => (
                      <div key={i} className="mb-2 text-sm">
                        <p className="font-medium">{c.topic}</p>
                        <p className="text-muted-foreground">{c.summary}</p>
                        <p className="text-xs italic">Trade-off: {c.trade_off}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="rounded-lg bg-muted p-4">
                  <Badge>Bodi Resolution</Badge>
                  <p className="mt-2 text-sm">{summary.resolution_summary}</p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}