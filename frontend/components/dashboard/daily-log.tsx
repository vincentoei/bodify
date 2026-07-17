"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { apiPost, apiFetch } from "@/lib/api";
import { Mic, Send, Loader2, AlertTriangle } from "lucide-react";

interface DailyLogProps {
  onLogSubmitted: (result: DailyLogResult) => void;
  disabled?: boolean;
}

export interface ParsedEntry {
  type: "meal" | "workout" | "hydration" | "sleep" | "other";
  description: string;
  estimated_calories: number | null;
  grams_protein: number | null;
  grams_carbs: number | null;
  grams_fat: number | null;
  grams_fiber: number | null;
  liters_water: number | null;
  hours_sleep: number | null;
  time_of_day: string | null;
  matches_planned_event: boolean;
}

export interface DailyLogResult {
  parsed: {
    entries: ParsedEntry[];
    total_calories_consumed: number | null;
    total_calories_burned: number | null;
    total_grams_protein: number | null;
    total_grams_carbs: number | null;
    total_grams_fat: number | null;
    total_grams_fiber: number | null;
    total_liters_water: number | null;
    total_hours_sleep: number | null;
    missed_event_types: string[];
    summary: string;
  };
  calories_consumed: number | null;
  calorie_target: number | null;
  status: "on_target" | "under" | "over";
  message: string;
  updated_events: any[];
}

export function DailyLog({ onLogSubmitted, disabled }: DailyLogProps) {
  const [text, setText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startListening = async () => {
    setText("");
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        await transcribe(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.onerror = () => {
        setIsListening(false);
      };

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

      const res = await apiFetch("/stt/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Transcription failed");
      }

      const data = await res.json();
      setText((prev) => (prev ? prev + " " : "") + (data.transcript || ""));
    } catch (err: any) {
      alert(err.message || "Transcription failed");
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleSubmit = () => {
    if (!text.trim()) return;
    setShowConfirm(true);
  };

  const confirmSubmit = async () => {
    setShowConfirm(false);
    setIsSubmitting(true);
    try {
      const result = await apiPost<DailyLogResult>("/log/daily", { text });
      onLogSubmitted(result);
      setText("");
    } catch (err: any) {
      alert(err.message || "Failed to submit daily log.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-brandDark/10 bg-white p-4">
      {disabled ? (
        <div className="text-center py-2">
          <p className="font-medium text-brandDark">You&apos;ve already logged today.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Come back tomorrow to log a new entry.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-start gap-2 text-sm text-amber-700">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          This is your end-of-day log. Once you send it, it will be final for today.
          Please review your message before submitting.
        </p>
      </div>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Tell Bodi what you ate, how you moved, etc"
        rows={4}
        disabled={isListening || isTranscribing}
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
            isListening
              ? "bg-red-50 border-red-300 text-red-600 hover:bg-red-100"
              : ""
          }`}
        >
          <Mic className="h-4 w-4" />
        </Button>

        <Button
          onClick={handleSubmit}
          disabled={isListening || isTranscribing || isSubmitting || !text.trim()}
          className="w-full bg-lightGreen text-brandDark hover:bg-lightGreen/90 disabled:cursor-not-allowed"
        >
          {isListening ? (
            "Bodi is listening... Press the mic button again to stop"
          ) : isTranscribing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending to Bodi...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Send to Bodi
            </>
          )}
        </Button>
      </div>

      {/* Confirmation modal */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Submit daily log?</DialogTitle>
            <DialogDescription>
              This will update today&apos;s schedule and cannot be edited or undone.
              Please review your message below.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border bg-zinc-50 p-3 text-sm text-brandDark">
            {text}
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              Edit
            </Button>
            <Button
              onClick={confirmSubmit}
              className="bg-lightGreen text-brandDark hover:bg-lightGreen/90"
            >
              Send to Bodi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>
      )}
    </div>
  );
}
