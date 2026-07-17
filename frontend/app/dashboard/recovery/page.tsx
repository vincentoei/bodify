"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { apiFetch, apiStream, apiGet, apiDelete } from "@/lib/api";
import { getAgentByName } from "@/lib/agents";
import {
  Mic,
  Send,
  Loader2,
  CalendarX,
  Cookie,
  Frown,
  HeartPulse,
  Plane,
  PartyPopper,
  Briefcase,
  MoreHorizontal,
  Check,
  Trash2,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";

// Display-only cards covering past + future disruption categories.
const RECOVERY_CARDS = [
  { label: "Missed Workout", icon: CalendarX, palette: "border-red-200 bg-red-50 text-red-700" },
  { label: "Ate Off-Plan", icon: Cookie, palette: "border-orange-200 bg-orange-50 text-orange-700" },
  { label: "Low Motivation", icon: Frown, palette: "border-purple-200 bg-purple-50 text-purple-700" },
  { label: "Sick / Injury", icon: HeartPulse, palette: "border-rose-200 bg-rose-50 text-rose-700" },
  { label: "Travelling", icon: Plane, palette: "border-blue-200 bg-blue-50 text-blue-700" },
  { label: "Social Event / Party", icon: PartyPopper, palette: "border-amber-200 bg-amber-50 text-amber-700" },
  { label: "Busy / Work Deadline", icon: Briefcase, palette: "border-slate-200 bg-slate-50 text-slate-700" },
  { label: "Others", icon: MoreHorizontal, palette: "border-zinc-200 bg-zinc-50 text-zinc-700" },
] as const;

interface ChatEvent {
  kind: "agent" | "coordinator" | "duplicate" | "system";
  agentName?: string;
  role?: string;
  rationale?: string;
  confidence?: number;
  message?: string;
}

interface MemoryRow {
  id: string;
  content: string;
  category: string;
  source_agent: string | null;
  active: boolean;
  created_at: string | null;
  expires_at: string | null;
}

const HINT_TEXT =
  "Future plans won't use this.";

export default function RecoveryPage() {
  const [text, setText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [chat, setChat] = useState<ChatEvent[]>([]);
  const [result, setResult] = useState<any>(null);
  const [calendarChanges, setCalendarChanges] = useState<any[]>([]);
  const [adaptationCount, setAdaptationCount] = useState<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Memories panel
  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [memoriesOpen, setMemoriesOpen] = useState(false);
  const [memoriesLoaded, setMemoriesLoaded] = useState(false);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletedHintForId, setDeletedHintForId] = useState<string | null>(null);

  const loadMemories = async () => {
    setMemoriesLoading(true);
    try {
      const data = await apiGet<{ memories: MemoryRow[] }>("/recovery/memories");
      setMemories(data.memories || []);
      setMemoriesLoaded(true);
    } catch (err: any) {
      setChat((prev) => [
        ...prev,
        { kind: "system", message: `Could not load memories: ${err.message || "unknown"}` },
      ]);
    } finally {
      setMemoriesLoading(false);
    }
  };

  useEffect(() => {
    if (memoriesOpen && !memoriesLoaded) loadMemories();
  }, [memoriesOpen, memoriesLoaded]);

  const handleDeleteMemory = async (id: string) => {
    setDeletingId(id);
    try {
      await apiDelete<{ id: string; active: boolean }>(`/recovery/memories/${id}`);
      setMemories((prev) => prev.filter((m) => m.id !== id));
      setPendingDeleteId(null);
      setDeletedHintForId(id);
      window.setTimeout(() => setDeletedHintForId(null), 5000);
    } catch (err: any) {
      setChat((prev) => [
        ...prev,
        { kind: "system", message: `Delete failed: ${err.message || "unknown"}` },
      ]);
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat, isSubmitting]);

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
      if (!res.ok) throw new Error(await res.text() || "Transcription failed");
      const data = await res.json();
      setText((prev) => (prev ? prev + " " : "") + (data.transcript || ""));
    } catch (err: any) {
      alert(err.message || "Transcription failed");
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setChat([]);
    setResult(null);
    setCalendarChanges([]);
    setIsSubmitting(true);
    try {
      await apiStream("/recovery/stream", { text }, (event, data) => {
        if (event === "fact") {
          // could surface facts immediately if desired
          return;
        }
        if (event === "duplicate") {
          setChat((prev) => [
            ...prev,
            { kind: "duplicate", message: data.message },
          ]);
          return;
        }
        if (event === "start") {
          return;
        }
        if (event === "system") {
          setChat((prev) => [...prev, { kind: "system", message: data.message }]);
          return;
        }
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
          setResult(data);
          setCalendarChanges(data.calendar_changes || []);
          setAdaptationCount(
            typeof data.adaptation_count === "number" ? data.adaptation_count : null,
          );
          setChat((prev) => [
            ...prev,
            {
              kind: "coordinator",
              message: data.resolution_summary,
              agentName: "Bodi",
            },
          ]);
          return;
        }
        if (event === "done") {
          return;
        }
        if (event === "error") {
          setChat((prev) => [
            ...prev,
            { kind: "system", message: `Error: ${data.error || "unknown"}` },
          ]);
        }
      });
      setText("");
      if (memoriesLoaded) loadMemories();
    } catch (err: any) {
      setChat((prev) => [
        ...prev,
        { kind: "system", message: err.message || "Failed to submit recovery message." },
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const busy = isListening || isTranscribing || isSubmitting;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Adaptive Recovery</h1>
        <p className="text-muted-foreground">
          Tell Bodi what happened or what&apos;s coming. The agent council will adapt your plan compassionately.
        </p>
      </div>

      {/* Display-only category cards */}
      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Examples of what you can tell Bodi
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          {RECOVERY_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className={`flex flex-col gap-2 rounded-xl border p-4 ${card.palette}`}
                aria-disabled="true"
              >
                <Icon className="h-5 w-5" />
                <span className="text-sm font-semibold">{card.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Input area: STT + textarea + send */}
      <div className="rounded-xl border border-brandDark/10 bg-white p-4">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g., Every Friday I have a party and I will eat a lot of calories."
          rows={4}
          disabled={busy}
          className="mb-3 resize-none"
        />
        <div className="flex items-center justify-between gap-3">
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
            onClick={handleSubmit}
            disabled={busy || !text.trim()}
            className="w-full bg-lightGreen text-brandDark hover:bg-lightGreen/90 disabled:cursor-not-allowed"
          >
            {isListening ? (
              "Bodi is listening... Press the mic again to stop"
            ) : isTranscribing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Transcribing...
              </>
            ) : isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Talking to the council...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send to Bodi
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Remembered context panel */}
      <MemoriesPanel
        open={memoriesOpen}
        onToggle={() => setMemoriesOpen((v) => !v)}
        loading={memoriesLoading}
        memories={memories}
        pendingDeleteId={pendingDeleteId}
        deletingId={deletingId}
        deletedHintForId={deletedHintForId}
        onRequestDelete={(id) => setPendingDeleteId(id)}
        onConfirmDelete={handleDeleteMemory}
        onCancelDelete={() => setPendingDeleteId(null)}
      />

      {/* Chat thread */}
      {chat.length > 0 && (
        <div ref={scrollRef} className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
          {chat.map((c, idx) => (
            <ChatBubble key={idx} event={c} />
          ))}
        </div>
      )}

      {/* Bodi resolution + calendar changes */}
      {result && (
        <Card className="border-lightGreen/40 bg-lightGreen/10">
          <CardHeader>
            <CardTitle>Plan adapted</CardTitle>
            <CardDescription>Bodi resolved the council into concrete calendar changes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-white p-3 text-sm leading-relaxed">
              {result.resolution_summary}
            </div>
            {calendarChanges.length > 0 ? (
                <CalendarChanges changes={calendarChanges} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  No calendar changes were needed for this message. Your current schedule stays as-is.
                </p>
              )}
            {result.persisted_facts?.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Durable memories</p>
                <ul className="space-y-1.5">
                  {result.persisted_facts.map((f: any, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Badge variant="outline" className="capitalize">{f.category}</Badge>
                      <span className="text-muted-foreground">{f.content}</span>
                      {f.status === "updated" && (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-800">updated</Badge>
                      )}
                      {f.status === "created" && (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">new</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {adaptationCount !== null && (
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="secondary" className="bg-lightGreen/20 text-brandDark">
                  Recorded to plan
                </Badge>
                <span className="text-muted-foreground">
                  {adaptationCount} adaptation{adaptationCount === 1 ? "" : "s"} total
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ChatBubble({ event }: { event: ChatEvent }) {
  const agent = event.agentName ? getAgentByName(event.agentName) : undefined;
  const Icon = agent?.icon;
  const isCoord = event.kind === "coordinator";
  const isDup = event.kind === "duplicate";
  const isSystem = event.kind === "system";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-start gap-3"
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${agent?.bgColor || "bg-zinc-100"} ${agent?.iconColor || "text-zinc-700"}`}
      >
        {Icon ? <Icon className="h-4 w-4" /> : isCoord ? <Check className="h-4 w-4 text-lightGreen" /> : isDup ? <Frown className="h-4 w-4" /> : <MoreHorizontal className="h-4 w-4" />}
      </div>
      <div className="max-w-[85%] rounded-2xl rounded-tl-sm border bg-white px-4 py-3 shadow-sm">
        {agent && (
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold text-brandDark">{agent.shortName}</span>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {event.role}
            </span>
          </div>
        )}
        <p className="text-sm leading-relaxed">
          {isDup ? (
            <span className="italic text-muted-foreground">{event.message}</span>
          ) : isCoord ? (
            event.message
          ) : isSystem ? (
            <span className="text-red-600">{event.message}</span>
          ) : (
            event.rationale
          )}
        </p>
        {typeof event.confidence === "number" && (
          <div className="mt-1 text-[10px] text-muted-foreground">
            {Math.round((event.confidence || 0) * 100)}% confidence
          </div>
        )}
      </div>
    </motion.div>
  );
}

function CalendarChanges({ changes }: { changes: any[] }) {
  const applied = changes.filter((c) => !c.error);
  const failed = changes.filter((c) => c.error);
  return (
    <div className="space-y-4">
      {applied.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Calendar changes</p>
          <ul className="space-y-1.5">
            {applied.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Badge key={i} variant="outline" className="capitalize">{c.action}</Badge>
                <span className="text-muted-foreground">
                  {c.date?.slice(0, 10)} · {c.type} · {c.title}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {failed.length > 0 && (
        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-800">Could not apply</p>
          <ul className="space-y-1.5">
            {failed.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-amber-800">
                <Badge variant="outline" className="border-amber-300 bg-white capitalize">{c.action}</Badge>
                <span>{c.date} · {c.error}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface MemoriesPanelProps {
  open: boolean;
  onToggle: () => void;
  loading: boolean;
  memories: MemoryRow[];
  pendingDeleteId: string | null;
  deletingId: string | null;
  deletedHintForId: string | null;
  onRequestDelete: (id: string) => void;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
}

function MemoriesPanel({
  open,
  onToggle,
  loading,
  memories,
  pendingDeleteId,
  deletingId,
  deletedHintForId,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
}: MemoriesPanelProps) {
  const ToggleIcon = open ? ChevronDown : ChevronRight;
  const hintId = deletedHintForId && !memories.find((m) => m.id === deletedHintForId)
    ? deletedHintForId
    : null;
  return (
    <Card className="border-brandDark/10 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <ToggleIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Remembered context</span>
          {memories.length > 0 && (
            <Badge variant="secondary" className="bg-brandDark/5 text-brandDark">
              {memories.length}
            </Badge>
          )}
        </span>
        <span className="text-xs text-muted-foreground">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open && (
        <CardContent className="space-y-3 pt-0">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading...
            </div>
          )}
          {!loading && memories.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No saved context yet. Tell Bodi about travel, recurring events, injuries, or schedule
              shifts and durable facts will appear here.
            </p>
          )}
          {memories.length > 0 && (
            <ul className="space-y-2">
              {memories.map((m) => {
                const isPending = pendingDeleteId === m.id;
                const isDeleting = deletingId === m.id;
                return (
                  <li
                    key={m.id}
                    className="rounded-lg border border-brandDark/5 bg-offWhite/30 p-3"
                  >
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="capitalize shrink-0">
                        {m.category}
                      </Badge>
                      <span className="flex-1 text-sm text-muted-foreground">{m.content}</span>
                      {!isPending && !isDeleting && (
                        <button
                          type="button"
                          onClick={() => onRequestDelete(m.id)}
                          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                          aria-label="Delete memory"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {isPending && !isDeleting && (
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onConfirmDelete(m.id)}
                            className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={onCancelDelete}
                            className="rounded-md p-1 text-muted-foreground hover:bg-brandDark/5"
                            aria-label="Cancel delete"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                      {isDeleting && (
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    {m.created_at && (
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        saved {new Date(m.created_at).toLocaleDateString()}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {hintId && (
            <div className="rounded-lg border border-brandBlue/20 bg-brandBlue/5 p-2.5 text-xs text-brandBlue">
              {HINT_TEXT}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}