"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import type { EditorLang } from "./CodeEditor";
import type { RunResult } from "@/lib/runner";
import { TRACK_META } from "./Runner";

const CodeEditor = dynamic(() => import("./CodeEditor"), { ssr: false });

export interface RosettaCell {
  trackId: string;
  trackName: string;
  color: string;
  slug: string;
  title: string;
  code: string;
  transfer: string | null;
}

export default function RosettaBoard({ cells }: { cells: RosettaCell[] }) {
  const [codes, setCodes] = useState<Record<string, string>>(() => Object.fromEntries(cells.map((c) => [c.trackId, c.code])));
  const [results, setResults] = useState<Record<string, RunResult | null>>({});
  const [running, setRunning] = useState<Record<string, boolean>>({});

  const runOne = async (trackId: string) => {
    setRunning((r) => ({ ...r, [trackId]: true }));
    setResults((r) => ({ ...r, [trackId]: null }));
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId, code: codes[trackId] }),
      });
      const data = (await res.json()) as RunResult;
      setResults((r) => ({ ...r, [trackId]: data }));
    } finally {
      setRunning((r) => ({ ...r, [trackId]: false }));
    }
  };

  const runAll = () => cells.forEach((c) => runOne(c.trackId));
  const anyRunning = Object.values(running).some(Boolean);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-400">Edit any panel freely, then run them individually or all at once. Compare the outputs – they should be identical.</p>
        <button onClick={runAll} disabled={anyRunning} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-60">
          {anyRunning ? "Running…" : "▶ Run all 5"}
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cells.map((c) => {
          const r = results[c.trackId];
          const meta = TRACK_META[c.trackId as EditorLang];
          return (
            <article key={c.trackId} className="flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#0b1120]">
              <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold" style={{ color: c.color }}>
                    {c.trackName}
                  </span>
                  <Link href={`/learn/${c.trackId}/${c.slug}`} className="text-xs text-slate-500 hover:text-slate-300">
                    {c.title} ↗
                  </Link>
                </div>
                <button
                  onClick={() => runOne(c.trackId)}
                  disabled={running[c.trackId]}
                  className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-60"
                >
                  {running[c.trackId] ? "…" : "▶ Run"}
                </button>
              </header>
              <CodeEditor lang={c.trackId as EditorLang} value={codes[c.trackId]} onChange={(v) => setCodes((s) => ({ ...s, [c.trackId]: v }))} height="260px" />
              <div className="border-t border-slate-800 bg-black p-3 font-mono text-xs">
                <div className="mb-1 text-slate-600">$ {meta?.cmd}</div>
                {running[c.trackId] && <div className="animate-pulse text-slate-400">▍ running…</div>}
                {r && (
                  <>
                    {r.compileOutput && !r.ok && <pre className="whitespace-pre-wrap text-rose-300">{r.compileOutput}</pre>}
                    {r.stdout && <pre className="whitespace-pre-wrap text-slate-100">{r.stdout}</pre>}
                    {r.stderr && <pre className="whitespace-pre-wrap text-rose-300">{r.stderr}</pre>}
                    <div className={`mt-1 ${r.ok ? "text-emerald-500" : "text-rose-400"}`}>
                      exit {r.exitCode ?? "?"} · {r.durationMs} ms · {r.engine}
                    </div>
                  </>
                )}
                {!r && !running[c.trackId] && <div className="text-slate-700">(not run yet)</div>}
              </div>
              {c.transfer && <p className="border-t border-slate-800 bg-slate-900/40 px-3 py-2 text-[11px] leading-relaxed text-slate-400">{c.transfer}</p>}
            </article>
          );
        })}
      </div>
    </div>
  );
}
