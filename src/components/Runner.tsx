"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EditorLang } from "./CodeEditor";
import type { RunResult } from "@/lib/runner";

const CodeEditor = dynamic(() => import("./CodeEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] items-center justify-center rounded-xl bg-[#0b1120] text-sm text-slate-500">
      Loading editor…
    </div>
  ),
});

export const TRACK_META: Record<EditorLang, { name: string; color: string; file: string; cmd: string }> = {
  c: { name: "C", color: "#60a5fa", file: "main.c", cmd: "gcc main.c -o main && ./main" },
  rust: { name: "Rust", color: "#fb923c", file: "main.rs", cmd: "rustc main.rs && ./main" },
  go: { name: "Go", color: "#22d3ee", file: "main.go", cmd: "go run main.go" },
  php: { name: "PHP", color: "#a78bfa", file: "main.php", cmd: "php main.php" },
  node: { name: "Node.js", color: "#4ade80", file: "main.js", cmd: "node main.js" },
  python: { name: "Python", color: "#facc15", file: "main.py", cmd: "python3 main.py" },
};

export type VerifyState = "idle" | "pass" | "fail";

interface RunnerProps {
  lang: EditorLang;
  initialCode: string;
  initialStdin?: string;
  expectedOutput?: string | null;
  editorHeight?: string;
  /** Called after each run so parents can persist / verify. */
  onRun?: (result: RunResult, code: string, verify: VerifyState) => void;
  onCodeChange?: (code: string) => void;
  /** Extra toolbar content (e.g. save button). */
  toolbar?: React.ReactNode;
  /** Controlled code value (optional). */
  code?: string;
  stdin?: string;
  onStdinChange?: (v: string) => void;
}

function normalize(s: string) {
  return s
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n")
    .trim();
}

function looksLikeHtml(s: string) {
  return /<\s*(html|!doctype|body|div|h[1-6]|p|ul|ol|table)\b/i.test(s);
}

export default function Runner(props: RunnerProps) {
  const { lang, expectedOutput, onRun, onCodeChange, toolbar, editorHeight = "420px" } = props;
  const [internalCode, setInternalCode] = useState(props.initialCode);
  const [internalStdin, setInternalStdin] = useState(props.initialStdin ?? "");
  const code = props.code ?? internalCode;
  const stdin = props.stdin ?? internalStdin;

  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState<"terminal" | "screen">("terminal");
  const [showStdin, setShowStdin] = useState(Boolean(props.initialStdin));
  const [verify, setVerify] = useState<VerifyState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const meta = TRACK_META[lang];

  const setCode = (v: string) => {
    setInternalCode(v);
    onCodeChange?.(v);
  };
  const setStdin = (v: string) => {
    setInternalStdin(v);
    props.onStdinChange?.(v);
  };

  // reset editor content when lesson / language changes
  useEffect(() => {
    setInternalCode(props.initialCode);
    setResult(null);
    setVerify("idle");
    setTab("terminal");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.initialCode, lang]);

  const run = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setResult(null);
    setVerify("idle");
    setElapsed(0);
    const t0 = Date.now();
    timerRef.current = setInterval(() => setElapsed(Date.now() - t0), 100);
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId: lang, code, stdin }),
      });
      const data = (await res.json()) as RunResult & { error?: string };
      const r: RunResult = data.error
        ? { ok: false, engine: "local", stdout: "", stderr: data.error, compileOutput: "", exitCode: null, durationMs: 0, timedOut: false }
        : data;
      setResult(r);
      let v: VerifyState = "idle";
      if (expectedOutput !== undefined) {
        if (expectedOutput === null) v = r.ok ? "pass" : "fail";
        else v = r.ok && normalize(r.stdout) === normalize(expectedOutput) ? "pass" : "fail";
      }
      setVerify(v);
      if (r.ok && looksLikeHtml(r.stdout)) setTab("screen");
      else setTab("terminal");
      onRun?.(r, code, v);
    } catch (err) {
      setResult({
        ok: false,
        engine: "local",
        stdout: "",
        stderr: `Network error: ${err instanceof Error ? err.message : String(err)}`,
        compileOutput: "",
        exitCode: null,
        durationMs: 0,
        timedOut: false,
      });
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
      setRunning(false);
    }
  }, [running, lang, code, stdin, expectedOutput, onRun]);

  // Ctrl/Cmd + Enter to run
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        run();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [run]);

  const htmlPreview = useMemo(() => (result?.ok && looksLikeHtml(result.stdout) ? result.stdout : null), [result]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* ───────── Editor ───────── */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0b1120] shadow-xl shadow-black/30">
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/80 px-3 py-2">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="flex gap-1.5">
              <i className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
              <i className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
              <i className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
            </span>
            <span className="ml-2 rounded-md bg-slate-800 px-2 py-0.5 font-mono text-slate-200">{meta.file}</span>
            <span className="hidden sm:inline" style={{ color: meta.color }}>
              ● {meta.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {toolbar}
            <button
              onClick={() => setCode(props.initialCode)}
              className="rounded-lg px-2.5 py-1.5 text-xs text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
              title="Reset to starter code"
            >
              ↺ Reset
            </button>
            <button
              onClick={run}
              disabled={running}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-emerald-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-60"
              title="Run (Ctrl/⌘ + Enter)"
            >
              {running ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-900/40 border-t-emerald-900" />
                  Running {(elapsed / 1000).toFixed(1)}s
                </>
              ) : (
                <>▶ Run</>
              )}
            </button>
          </div>
        </div>
        <CodeEditor lang={lang} value={code} onChange={setCode} height={editorHeight} />
        <div className="border-t border-slate-800 bg-slate-900/60">
          <button
            onClick={() => setShowStdin((s) => !s)}
            className="flex w-full items-center justify-between px-3 py-1.5 text-left text-[11px] uppercase tracking-wider text-slate-500 hover:text-slate-300"
          >
            <span>stdin (program input)</span>
            <span>{showStdin ? "−" : "+"}</span>
          </button>
          {showStdin && (
            <textarea
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              placeholder="Text your program will read from standard input…"
              className="block h-20 w-full resize-y border-0 bg-[#0b1120] px-3 py-2 font-mono text-xs text-slate-200 outline-none placeholder:text-slate-600"
            />
          )}
        </div>
      </div>

      {/* ───────── Screen / Terminal ───────── */}
      <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-black shadow-xl shadow-black/30">
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-3 py-2">
          <div className="flex gap-1 text-xs">
            <button
              onClick={() => setTab("terminal")}
              className={`rounded-md px-2.5 py-1 ${tab === "terminal" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"}`}
            >
              ▣ Terminal
            </button>
            <button
              onClick={() => setTab("screen")}
              className={`rounded-md px-2.5 py-1 ${tab === "screen" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"}`}
            >
              🖥 Screen{htmlPreview ? " •" : ""}
            </button>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            {result && (
              <>
                <span className={`rounded-md px-2 py-0.5 font-mono ${result.ok ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>
                  exit {result.exitCode ?? "?"}
                </span>
                <span className="font-mono">{result.durationMs} ms</span>
                <span
                  className="hidden rounded-md bg-slate-800 px-2 py-0.5 sm:inline"
                  title={result.engine === "local" ? "Executed on this server's toolchain" : `Executed in a remote sandbox (${result.engine})`}
                >
                  {result.engine === "local" ? "local" : `cloud · ${result.engine}`}
                </span>
              </>
            )}
            {verify === "pass" && <span className="rounded-md bg-emerald-500 px-2 py-0.5 font-semibold text-emerald-950">✓ Output verified</span>}
            {verify === "fail" && <span className="rounded-md bg-amber-500/20 px-2 py-0.5 font-semibold text-amber-300">Not matching yet</span>}
          </div>
        </div>

        <div className="relative min-h-[320px] flex-1" style={{ minHeight: editorHeight }}>
          {tab === "terminal" ? (
            <div className="h-full overflow-auto p-4 font-mono text-[13px] leading-relaxed">
              <div className="mb-2 text-slate-500">
                <span className="text-emerald-400">learner@playground</span>:<span className="text-sky-400">~</span>$ {meta.cmd}
              </div>
              {running && (
                <div className="text-slate-400">
                  <span className="animate-pulse">▍</span> compiling &amp; running…
                </div>
              )}
              {!running && !result && (
                <div className="text-slate-600">Press ▶ Run (or Ctrl/⌘ + Enter) to execute your program. Output appears here, live.</div>
              )}
              {result && (
                <>
                  {result.compileOutput && (
                    <pre className={`mb-3 whitespace-pre-wrap rounded-lg border p-3 ${result.ok ? "border-amber-500/30 bg-amber-500/5 text-amber-200" : "border-rose-500/40 bg-rose-500/5 text-rose-200"}`}>
                      <span className="mb-1 block text-[10px] uppercase tracking-wider opacity-70">{result.ok ? "compiler warnings" : "compiler errors"}</span>
                      {result.compileOutput}
                    </pre>
                  )}
                  {result.stdout && <pre className="whitespace-pre-wrap text-slate-100">{result.stdout}</pre>}
                  {result.stderr && <pre className="mt-2 whitespace-pre-wrap text-rose-300">{result.stderr}</pre>}
                  {!result.stdout && !result.stderr && !result.compileOutput && <div className="text-slate-500">(no output)</div>}
                  {verify === "fail" && expectedOutput && (
                    <details className="mt-4 rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-xs text-slate-300">
                      <summary className="cursor-pointer text-amber-300">Show expected output</summary>
                      <pre className="mt-2 whitespace-pre-wrap text-slate-200">{expectedOutput}</pre>
                    </details>
                  )}
                  <div className="mt-3 text-slate-600">
                    [process exited with code {result.exitCode ?? "?"} in {result.durationMs} ms]
                  </div>
                </>
              )}
            </div>
          ) : htmlPreview ? (
            <iframe
              title="Program screen"
              sandbox=""
              srcDoc={htmlPreview}
              className="h-full min-h-[320px] w-full border-0 bg-white"
              style={{ minHeight: editorHeight }}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-slate-500" style={{ minHeight: editorHeight }}>
              <div className="text-4xl">🖥</div>
              <p className="max-w-xs">
                The <strong className="text-slate-300">Screen</strong> renders your program&apos;s output as a web page when it prints HTML.
                Try the PHP template lesson, or <code className="rounded bg-slate-800 px-1">console.log(&quot;&lt;h1&gt;Hi&lt;/h1&gt;&quot;)</code> in Node.
              </p>
              {result?.stdout && !htmlPreview && (
                <pre className="mt-2 max-h-40 w-full overflow-auto rounded-lg bg-slate-900 p-3 text-left font-mono text-xs text-slate-300">{result.stdout}</pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
