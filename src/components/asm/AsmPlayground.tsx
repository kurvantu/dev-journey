"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@/lib/asm/plugins"; // side effect: registers external plugins (ARM)
import { listAsmPlugins } from "@/lib/asm/registry";
import { DATA_BASE, type AsmPlugin, type Machine } from "@/lib/asm/types";

/* ───────────────────────────── speed options ───────────────────────────── */

const SPEED_OPTIONS = [
  { id: "slow", label: "Speed: Slow", desc: "2 instructions / second — follow every move", delay: 500, batch: 1 },
  { id: "medium", label: "Speed: Medium", desc: "10 instructions / second", delay: 100, batch: 1 },
  { id: "high", label: "Speed: High", desc: "≈100 instructions / second", delay: 10, batch: 1 },
  { id: "max", label: "Speed: Max", desc: "as fast as possible (batched)", delay: 0, batch: 10000 },
] as const;
type SpeedId = (typeof SPEED_OPTIONS)[number]["id"];

/* ───────────────────────────── helpers ───────────────────────────── */

const hex = (v: bigint | number, digits: number) => v.toString(16).toUpperCase().padStart(digits, "0");

function fmtSigned(v: bigint, bits: number): string {
  const sb = 1n << BigInt(bits - 1);
  const m = (1n << BigInt(bits)) - 1n;
  const s = (v & m) >= sb ? (v & m) - m - 1n : v & m;
  return s.toString();
}

const printable = (b: number) => (b >= 32 && b < 127 ? String.fromCharCode(b) : "·");

/* ───────────────────────────── main component ───────────────────────────── */

export default function AsmPlayground() {
  const plugins = useMemo(() => listAsmPlugins(), []);
  const [plugin, setPlugin] = useState<AsmPlugin>(plugins[0]);
  const [source, setSource] = useState<string>(plugins[0].examples[0].code);
  const [speed, setSpeed] = useState<SpeedId>("slow");
  const [mode, setMode] = useState<"edit" | "run">("edit");
  const [running, setRunning] = useState(false);
  const [asmErrors, setAsmErrors] = useState<{ line: number; message: string }[]>([]);
  const [, bump] = useState(0);
  const machineRef = useRef<Machine | null>(null);
  const [machineVersion, setMachineVersion] = useState(0);
  const listingRef = useRef<HTMLDivElement>(null);
  const currentRowRef = useRef<HTMLDivElement>(null);

  const m = machineRef.current;

  const switchPlugin = (id: string) => {
    const p = plugins.find((x) => x.id === id);
    if (!p) return;
    setPlugin(p);
    setSource(p.examples[0].code);
    machineRef.current = null;
    setRunning(false);
    setMode("edit");
    setAsmErrors([]);
  };

  const loadExample = (name: string) => {
    const ex = plugin.examples.find((e) => e.name === name);
    if (!ex) return;
    setSource(ex.code);
    machineRef.current = null;
    setRunning(false);
    setMode("edit");
    setAsmErrors([]);
  };

  const assemble = useCallback((): Machine | null => {
    const prog = plugin.assemble(source);
    if (prog.errors.length) {
      setAsmErrors(prog.errors.slice(0, 12));
      machineRef.current = null;
      setMode("edit");
      return null;
    }
    setAsmErrors([]);
    const machine = plugin.createMachine(prog);
    machineRef.current = machine;
    setMode("run");
    setMachineVersion((v) => v + 1);
    bump((n) => n + 1);
    return machine;
  }, [plugin, source]);

  const reset = useCallback(() => {
    setRunning(false);
    if (machineRef.current) {
      machineRef.current = plugin.createMachine(machineRef.current.prog);
      setMachineVersion((v) => v + 1);
      bump((n) => n + 1);
    }
  }, [plugin]);

  const stepOnce = useCallback(() => {
    let mm = machineRef.current;
    if (!mm) mm = assemble();
    if (!mm || mm.halted || mm.error) return;
    mm.step();
    bump((n) => n + 1);
  }, [assemble]);

  const toggleRun = useCallback(() => {
    if (running) {
      setRunning(false);
      return;
    }
    let mm = machineRef.current;
    if (!mm || mm.halted || mm.error) mm = assemble();
    if (!mm) return;
    setRunning(true);
  }, [running, assemble]);

  /* execution loop */
  useEffect(() => {
    if (!running) return;
    const opt = SPEED_OPTIONS.find((s) => s.id === speed)!;
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const mm = machineRef.current;
      if (!mm) { setRunning(false); return; }
      for (let i = 0; i < opt.batch && !mm.halted && !mm.error; i++) mm.step();
      bump((n) => n + 1);
      if (mm.halted || mm.error) { setRunning(false); return; }
      timer = setTimeout(tick, opt.delay);
    };
    timer = setTimeout(tick, opt.delay);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [running, speed, machineVersion]);

  /* auto-scroll the listing to the current instruction */
  useEffect(() => {
    if (mode === "run" && currentRowRef.current) {
      currentRowRef.current.scrollIntoView({ block: "nearest" });
    }
  });

  const curLine = m && !m.halted && !m.error ? m.prog.instructions[m.ip]?.line : undefined;
  const codeLineSet = useMemo(() => {
    const s = new Set<number>();
    m?.prog.instructions.forEach((i) => s.add(i.line));
    return s;
  }, [m?.prog]);

  const status = !m
    ? { text: "Ready — assemble to load the CPU", cls: "text-slate-400" }
    : m.error
      ? { text: `Runtime error (line ${m.error.line}): ${m.error.message}`, cls: "text-rose-300" }
      : m.halted
        ? { text: `Halted${m.exitCode !== null ? ` — exit code ${m.exitCode}` : ""}${m.haltNote ? ` · ${m.haltNote}` : ""}`, cls: "text-emerald-300" }
        : running
          ? { text: "Running…", cls: "text-amber-300" }
          : { text: "Paused — Step or Run to continue", cls: "text-sky-300" };

  return (
    <div className="space-y-4">
      {/* ─────────── control bar ─────────── */}
      <div className="sticky top-[57px] z-30 rounded-2xl border border-cyan-800/60 bg-[#071033]/95 p-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-cyan-200/70">
            Architecture
            <select
              value={plugin.id}
              onChange={(e) => switchPlugin(e.target.value)}
              className="rounded-lg border border-cyan-700/60 bg-[#0a1a4a] px-2 py-1.5 font-mono text-sm text-cyan-100 outline-none focus:border-cyan-400"
            >
              {plugins.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.origin === "plugin" ? "⧉ plugin" : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs text-cyan-200/70">
            Example
            <select
              value=""
              onChange={(e) => e.target.value && loadExample(e.target.value)}
              className="rounded-lg border border-cyan-700/60 bg-[#0a1a4a] px-2 py-1.5 text-sm text-cyan-100 outline-none focus:border-cyan-400"
            >
              <option value="">load…</option>
              {plugin.examples.map((ex) => (
                <option key={ex.name} value={ex.name}>{ex.name}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs text-cyan-200/70" title={SPEED_OPTIONS.find((s) => s.id === speed)?.desc}>
            <span className="hidden sm:inline">Execution</span>
            <select
              value={speed}
              onChange={(e) => setSpeed(e.target.value as SpeedId)}
              className="rounded-lg border border-amber-600/60 bg-[#0a1a4a] px-2 py-1.5 text-sm font-semibold text-amber-200 outline-none focus:border-amber-400"
            >
              {SPEED_OPTIONS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </label>

          <div className="mx-1 h-6 w-px bg-cyan-800/60" />

          <button onClick={() => assemble()} className="rounded-lg border border-cyan-600 bg-cyan-500/10 px-3 py-1.5 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/20">
            ⚙ Assemble
          </button>
          <button
            onClick={toggleRun}
            className={`rounded-lg px-4 py-1.5 text-sm font-bold ${running ? "bg-amber-400 text-amber-950 hover:bg-amber-300" : "bg-emerald-500 text-emerald-950 hover:bg-emerald-400"}`}
          >
            {running ? "⏸ Pause" : "▶ Run"}
          </button>
          <button onClick={stepOnce} disabled={running} className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:border-slate-400 disabled:opacity-40">
            ⭢ Step
          </button>
          <button onClick={reset} disabled={!m} className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:border-slate-400 disabled:opacity-40">
            ↺ Reset
          </button>
          {mode === "run" && (
            <button onClick={() => { setRunning(false); setMode("edit"); }} className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:border-slate-400">
              ✎ Edit
            </button>
          )}

          <div className="ml-auto flex items-center gap-3 font-mono text-xs">
            <span className="text-cyan-300/70">steps <b className="text-white">{m?.steps ?? 0}</b></span>
            <span className={status.cls}>{status.text.length > 64 ? status.text.slice(0, 64) + "…" : status.text}</span>
          </div>
        </div>
      </div>

      {asmErrors.length > 0 && (
        <div className="rounded-xl border border-rose-500/50 bg-rose-500/10 p-3 font-mono text-xs text-rose-200">
          <div className="mb-1 font-sans font-semibold">Assembler errors</div>
          {asmErrors.map((e, i) => (
            <div key={i}>line {e.line}: {e.message}</div>
          ))}
        </div>
      )}

      {/* ─────────── main grid ─────────── */}
      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        {/* left: source / listing */}
        <div className="overflow-hidden rounded-2xl border border-cyan-800/60 bg-[#050c28]">
          <div className="flex items-center justify-between border-b border-cyan-800/60 bg-[#0a1a4a] px-3 py-1.5">
            <span className="font-mono text-xs text-cyan-200">
              {mode === "edit" ? "source.asm — editing" : "listing — executing"} · {plugin.name}
              {plugin.origin === "plugin" && <span className="ml-2 rounded bg-fuchsia-500/20 px-1.5 py-0.5 text-[10px] font-bold text-fuchsia-300">PLUGIN</span>}
            </span>
            <span className="text-[10px] text-cyan-400/50">{plugin.subtitle}</span>
          </div>

          {mode === "edit" ? (
            <textarea
              value={source}
              onChange={(e) => setSource(e.target.value)}
              spellCheck={false}
              className="block h-[460px] w-full resize-none bg-transparent p-3 font-mono text-[13px] leading-[1.45] text-cyan-50 outline-none placeholder:text-slate-600"
              placeholder="; write assembly here, then ⚙ Assemble"
            />
          ) : (
            <div ref={listingRef} className="h-[460px] overflow-auto py-1 font-mono text-[13px] leading-[1.45]">
              {m?.prog.lines.map((text, i) => {
                const lineNo = i + 1;
                const isCur = lineNo === curLine;
                const isCode = codeLineSet.has(lineNo);
                return (
                  <div
                    key={i}
                    ref={isCur ? currentRowRef : undefined}
                    className={`flex px-2 ${isCur ? "bg-emerald-500/20 text-white" : isCode ? "text-cyan-100" : "text-slate-600"}`}
                  >
                    <span className={`w-9 shrink-0 select-none text-right pr-2 ${isCur ? "text-emerald-300" : "text-slate-700"}`}>{lineNo}</span>
                    <span className={`w-4 shrink-0 ${isCur ? "text-emerald-300" : ""}`}>{isCur ? "►" : " "}</span>
                    <span className="whitespace-pre">{text || " "}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* output console */}
          <div className="border-t-2 border-cyan-700 bg-[#0000a8] p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-cyan-300">Console output</span>
              {m?.halted && m.exitCode !== null && (
                <span className="rounded bg-emerald-400 px-1.5 font-mono text-[10px] font-bold text-emerald-950">exit {m.exitCode}</span>
              )}
            </div>
            <pre className="max-h-32 min-h-[3.5rem] overflow-auto whitespace-pre-wrap font-mono text-[13px] leading-snug text-white">
              {m?.output || <span className="text-cyan-400/60">— no output yet —</span>}
            </pre>
            {m?.error && <div className="mt-1 font-mono text-xs text-rose-300">✖ line {m.error.line}: {m.error.message}</div>}
            {m?.halted && m.haltNote && <div className="mt-1 font-mono text-[11px] text-cyan-300/80">{m.haltNote}</div>}
          </div>
        </div>

        {/* right: CPU state */}
        <div className="space-y-4">
          <RegistersPanel plugin={plugin} m={m} />
          <div className="grid gap-4 md:grid-cols-2">
            <StackPanel plugin={plugin} m={m} />
            <MemoryPanel m={m} />
          </div>
        </div>
      </div>

      {/* reference */}
      <details className="rounded-2xl border border-cyan-800/60 bg-[#071033]/70 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-cyan-200">
          📖 {plugin.name} quick reference — instructions &amp; syntax
        </summary>
        <p className="mt-3 text-xs leading-relaxed text-slate-400">{plugin.syntaxNote}</p>
        <div className="mt-3 grid gap-1.5 md:grid-cols-2">
          {plugin.reference.map((r) => (
            <div key={r.syntax} className="flex gap-3 rounded-lg bg-[#050c28] px-3 py-1.5 text-xs">
              <code className="w-56 shrink-0 font-mono text-amber-200">{r.syntax}</code>
              <span className="text-slate-400">{r.desc}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

/* ───────────────────────────── registers ───────────────────────────── */

function RegistersPanel({ plugin, m }: { plugin: AsmPlugin; m: Machine | null }) {
  return (
    <div className="rounded-2xl border border-cyan-800/60 bg-[#071033]/70 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-cyan-300">Registers</h3>
        <div className="flex gap-1.5">
          {plugin.flagNames.map((fl) => {
            const on = m?.flags[fl] ?? false;
            return (
              <span
                key={fl}
                title={`${fl} flag`}
                className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${on ? "bg-amber-400 text-amber-950" : "bg-slate-800 text-slate-500"}`}
              >
                {fl}={on ? 1 : 0}
              </span>
            );
          })}
        </div>
      </div>
      <div className="space-y-2">
        {plugin.registerGroups.map((g) => (
          <div key={g.title}>
            <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">{g.title}</div>
            <div className="grid grid-cols-2 gap-1 lg:grid-cols-2">
              {g.regs.map((r) => {
                const bits = plugin.regBits[r] ?? plugin.bits;
                const v = m ? m.readReg(r) : 0n;
                const changed = m ? m.lastChanged.has(m.fullOf(r)) : false;
                return (
                  <div
                    key={r}
                    className={`flex items-baseline gap-2 rounded-md px-2 py-1 font-mono text-xs transition-colors ${changed ? "bg-amber-400/90 text-amber-950" : "bg-[#050c28] text-cyan-100"}`}
                  >
                    <span className={`w-9 font-bold ${changed ? "" : "text-cyan-400"}`}>{r}</span>
                    <span className="tracking-tight">{hex(v, bits / 4)}</span>
                    <span className={`ml-auto text-[10px] ${changed ? "text-amber-900" : "text-slate-500"}`}>{fmtSigned(v, bits)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────────── stack ───────────────────────────── */

function StackPanel({ plugin, m }: { plugin: AsmPlugin; m: Machine | null }) {
  const word = plugin.bits / 8;
  const rows: { addr: number; v: bigint; isSp: boolean }[] = [];
  if (m) {
    const sp = m.spValue();
    const start = Math.max(0, sp - word * 2);
    for (let i = 0; i < 9; i++) {
      const addr = start + i * word;
      if (addr + word > m.mem.length || addr > m.initialSp) break;
      let v = 0n;
      for (let b = word - 1; b >= 0; b--) v = (v << 8n) | BigInt(m.mem[addr + b]);
      rows.push({ addr, v, isSp: addr === sp });
    }
  }
  return (
    <div className="rounded-2xl border border-cyan-800/60 bg-[#071033]/70 p-3">
      <h3 className="mb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-cyan-300">
        Stack <span className="normal-case text-slate-500">({plugin.sp} grows ↓)</span>
      </h3>
      {rows.length === 0 ? (
        <div className="py-4 text-center font-mono text-[11px] text-slate-600">empty — push something</div>
      ) : (
        <div className="space-y-0.5 font-mono text-[11px]">
          {rows.map((r) => (
            <div key={r.addr} className={`flex justify-between rounded px-2 py-0.5 ${r.isSp ? "bg-emerald-500/20 text-emerald-200" : "text-cyan-100/80"}`}>
              <span className="text-slate-500">{hex(r.addr, 4)}</span>
              <span>{hex(r.v, plugin.bits / 4)}</span>
              <span className={r.isSp ? "font-bold" : "text-transparent"}>◄ {plugin.sp}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────── memory ───────────────────────────── */

function MemoryPanel({ m }: { m: Machine | null }) {
  const len = m ? Math.min(Math.max(Math.ceil(m.prog.data.length / 16) * 16, 48), 160) : 48;
  const rows: number[] = [];
  for (let a = DATA_BASE; a < DATA_BASE + len; a += 16) rows.push(a);
  const hot = m?.lastMem;
  return (
    <div className="rounded-2xl border border-cyan-800/60 bg-[#071033]/70 p-3">
      <h3 className="mb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-cyan-300">
        Data segment <span className="normal-case text-slate-500">(from {hex(DATA_BASE, 4)})</span>
      </h3>
      <div className="overflow-auto">
        <div className="space-y-0.5 font-mono text-[10.5px] leading-snug">
          {rows.map((base) => (
            <div key={base} className="flex gap-2 whitespace-nowrap">
              <span className="text-slate-500">{hex(base, 4)}</span>
              <span>
                {Array.from({ length: 16 }, (_, i) => {
                  const b = m ? m.mem[base + i] : 0;
                  const isHot = hot && base + i >= hot.addr && base + i < hot.addr + hot.len;
                  return (
                    <span key={i} className={isHot ? "bg-amber-400 text-amber-950" : b !== 0 ? "text-cyan-100" : "text-slate-700"}>
                      {hex(b, 2)}{i === 7 ? "  " : " "}
                    </span>
                  );
                })}
              </span>
              <span className="text-emerald-300/70">
                {Array.from({ length: 16 }, (_, i) => printable(m ? m.mem[base + i] : 0)).join("")}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
