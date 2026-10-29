"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Runner, { type VerifyState } from "./Runner";
import type { EditorLang } from "./CodeEditor";
import type { RunResult } from "@/lib/runner";

export default function LessonWorkspace({
  lessonId,
  lang,
  starterCode,
  savedCode,
  expectedOutput,
  initiallyCompleted,
}: {
  lessonId: number;
  lang: EditorLang;
  starterCode: string;
  savedCode: string | null;
  expectedOutput: string | null;
  initiallyCompleted: boolean;
}) {
  const router = useRouter();
  const [completed, setCompleted] = useState(initiallyCompleted);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const latestCode = useRef(savedCode ?? starterCode);

  const persist = useCallback(
    async (patch: { code?: string; completed?: boolean }) => {
      setSaving(true);
      try {
        await fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonId, ...patch }),
        });
      } finally {
        setSaving(false);
      }
    },
    [lessonId],
  );

  const handleRun = useCallback(
    async (result: RunResult, code: string, verify: VerifyState) => {
      latestCode.current = code;
      const patch: { code: string; completed?: boolean } = { code };
      if (verify === "pass" && !completed) {
        patch.completed = true;
        setCompleted(true);
        setToast("Lesson verified and marked complete 🎉");
        setTimeout(() => setToast(null), 3500);
      }
      await persist(patch);
      if (patch.completed) router.refresh();
    },
    [completed, persist, router],
  );

  const toggleComplete = async () => {
    const next = !completed;
    setCompleted(next);
    await persist({ completed: next, code: latestCode.current });
    router.refresh();
  };

  return (
    <div className="relative">
      <Runner
        lang={lang}
        initialCode={savedCode ?? starterCode}
        expectedOutput={expectedOutput}
        onRun={handleRun}
        onCodeChange={(c) => (latestCode.current = c)}
        toolbar={
          <button
            onClick={toggleComplete}
            disabled={saving}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
              completed ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
            title={completed ? "Mark as not complete" : "Mark complete manually"}
          >
            {completed ? "✓ Completed" : "Mark complete"}
          </button>
        }
      />
      {toast && (
        <div className="float-in fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-emerald-500/40 bg-slate-900 px-4 py-2.5 text-sm text-emerald-200 shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}
