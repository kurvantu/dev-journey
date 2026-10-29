import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export type TrackId = "c" | "rust" | "go" | "php" | "node" | "python";

export type Engine = "local" | "rust-playground" | "go-playground" | "wandbox" | "piston";

export interface RunResult {
  ok: boolean;
  engine: Engine;
  stdout: string;
  stderr: string;
  compileOutput: string;
  exitCode: number | null;
  durationMs: number;
  timedOut: boolean;
}

const MAX_OUTPUT = 64 * 1024;
const RUN_TIMEOUT_MS = 10_000;
const COMPILE_TIMEOUT_MS = 20_000;

const PISTON_URL = process.env.PISTON_URL || null;

const PISTON_LANG: Record<TrackId, { language: string; version: string; file: string }> = {
  c: { language: "c", version: "10.2.0", file: "main.c" },
  rust: { language: "rust", version: "1.68.2", file: "main.rs" },
  go: { language: "go", version: "1.16.2", file: "main.go" },
  php: { language: "php", version: "8.2.3", file: "main.php" },
  node: { language: "javascript", version: "18.15.0", file: "main.js" },
  python: { language: "python", version: "3.10.0", file: "main.py" },
};

/* ───────────────────────── local toolchain detection ───────────────────────── */

const toolCache = new Map<string, Promise<boolean>>();

function hasTool(bin: string): Promise<boolean> {
  if (!toolCache.has(bin)) {
    toolCache.set(
      bin,
      new Promise((resolve) => {
        const p = spawn("sh", ["-c", `command -v ${bin}`], { stdio: "ignore" });
        p.on("error", () => resolve(false));
        p.on("close", (code) => resolve(code === 0));
      }),
    );
  }
  return toolCache.get(bin)!;
}

interface ProcResult {
  stdout: string;
  stderr: string;
  code: number | null;
  timedOut: boolean;
}

function exec(cmd: string, args: string[], opts: { cwd: string; stdin?: string; timeout: number }): Promise<ProcResult> {
  return new Promise((resolve) => {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      HOME: opts.cwd,
      LANG: "C.UTF-8",
      DATABASE_URL: undefined, // never leak secrets to learner programs
    };
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, opts.timeout);

    child.stdout.on("data", (d: Buffer) => {
      if (stdout.length < MAX_OUTPUT) stdout += d.toString("utf8");
    });
    child.stderr.on("data", (d: Buffer) => {
      if (stderr.length < MAX_OUTPUT) stderr += d.toString("utf8");
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ stdout, stderr: stderr + String(err), code: 1, timedOut });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout: stdout.slice(0, MAX_OUTPUT), stderr: stderr.slice(0, MAX_OUTPUT), code, timedOut });
    });
    if (opts.stdin) child.stdin.write(opts.stdin);
    child.stdin.end();
  });
}

async function runLocal(track: TrackId, code: string, stdin: string): Promise<RunResult | null> {
  const started = Date.now();
  const dir = await mkdtemp(path.join(tmpdir(), "playground-"));
  try {
    if (track === "c") {
      if (!(await hasTool("gcc"))) return null;
      await writeFile(path.join(dir, "main.c"), code);
      const compile = await exec("gcc", ["-std=c11", "-Wall", "-O0", "main.c", "-o", "main", "-lm"], {
        cwd: dir,
        timeout: COMPILE_TIMEOUT_MS,
      });
      if (compile.code !== 0) {
        return {
          ok: false,
          engine: "local",
          stdout: "",
          stderr: "",
          compileOutput: compile.stderr || compile.stdout,
          exitCode: compile.code,
          durationMs: Date.now() - started,
          timedOut: compile.timedOut,
        };
      }
      const run = await exec("./main", [], { cwd: dir, stdin, timeout: RUN_TIMEOUT_MS });
      return finish("local", run, compile.stderr, started);
    }
    if (track === "python") {
      if (!(await hasTool("python3"))) return null;
      await writeFile(path.join(dir, "main.py"), code);
      const run = await exec("python3", ["-u", "main.py"], { cwd: dir, stdin, timeout: RUN_TIMEOUT_MS * 3 });
      return finish("local", run, "", started);
    }
    if (track === "node") {
      if (!(await hasTool("node"))) return null;
      await writeFile(path.join(dir, "main.js"), code);
      const run = await exec("node", ["main.js"], { cwd: dir, stdin, timeout: RUN_TIMEOUT_MS });
      return finish("local", run, "", started);
    }
    if (track === "php") {
      if (!(await hasTool("php"))) return null;
      await writeFile(path.join(dir, "main.php"), code);
      const run = await exec("php", ["main.php"], { cwd: dir, stdin, timeout: RUN_TIMEOUT_MS });
      return finish("local", run, "", started);
    }
    if (track === "go") {
      if (!(await hasTool("go"))) return null;
      await writeFile(path.join(dir, "main.go"), code);
      const run = await exec("go", ["run", "main.go"], { cwd: dir, stdin, timeout: COMPILE_TIMEOUT_MS + RUN_TIMEOUT_MS });
      return finish("local", run, "", started);
    }
    if (track === "rust") {
      if (!(await hasTool("rustc"))) return null;
      await writeFile(path.join(dir, "main.rs"), code);
      const compile = await exec("rustc", ["main.rs", "-o", "main"], { cwd: dir, timeout: COMPILE_TIMEOUT_MS });
      if (compile.code !== 0) {
        return {
          ok: false,
          engine: "local",
          stdout: "",
          stderr: "",
          compileOutput: compile.stderr,
          exitCode: compile.code,
          durationMs: Date.now() - started,
          timedOut: compile.timedOut,
        };
      }
      const run = await exec("./main", [], { cwd: dir, stdin, timeout: RUN_TIMEOUT_MS });
      return finish("local", run, compile.stderr, started);
    }
    return null;
  } finally {
    rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

function finish(engine: Engine, run: ProcResult, compileOutput: string, started: number): RunResult {
  return {
    ok: run.code === 0 && !run.timedOut,
    engine,
    stdout: run.stdout,
    stderr: run.timedOut ? run.stderr + "\n[process killed: time limit exceeded]" : run.stderr,
    compileOutput,
    exitCode: run.code,
    durationMs: Date.now() - started,
    timedOut: run.timedOut,
  };
}

/* ──────────────────────────── cloud engines ──────────────────────────── */

function fail(engine: Engine, message: string, started: number): RunResult {
  return { ok: false, engine, stdout: "", stderr: message, compileOutput: "", exitCode: null, durationMs: Date.now() - started, timedOut: false };
}

async function fetchJson<T>(url: string, init: RequestInit, timeoutMs = 60_000): Promise<{ res: Response; data: T }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const data = (await res.json()) as T;
    return { res, data };
  } finally {
    clearTimeout(timer);
  }
}

/** Official Rust playground backend (no stdin support). */
async function runRustPlayground(code: string): Promise<RunResult> {
  const started = Date.now();
  try {
    const { res, data } = await fetchJson<{ success: boolean; exitDetail?: string; stdout: string; stderr: string; error?: string }>(
      "https://play.rust-lang.org/execute",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "stable", mode: "debug", edition: "2021", crateType: "bin", tests: false, code, backtrace: false }),
      },
    );
    if (!res.ok || data.error) return fail("rust-playground", data.error ?? `HTTP ${res.status}`, started);
    // Strip cargo's own progress lines – learners only want *their* stderr.
    const stderrLines = (data.stderr ?? "").split("\n").filter((l) => !/^\s*(Compiling|Finished|Running)\b/.test(l));
    const stderr = stderrLines.join("\n").trim();
    const compileFailed = !data.success && /^error(\[E\d+\])?:/m.test(stderr) && !(data.stdout ?? "").length;
    const hasWarnings = !compileFailed && /^warning:/m.test(stderr);
    const m = /status (\d+)/.exec(data.exitDetail ?? "");
    const exitCode = compileFailed ? 1 : m ? Number(m[1]) : data.success ? 0 : 1;
    const timedOut = /timed out|killed/i.test(data.exitDetail ?? "");
    return {
      ok: data.success && exitCode === 0,
      engine: "rust-playground",
      stdout: data.stdout ?? "",
      stderr: compileFailed || hasWarnings ? "" : stderr,
      compileOutput: compileFailed || hasWarnings ? stderr : "",
      exitCode,
      durationMs: Date.now() - started,
      timedOut,
    };
  } catch (err) {
    return fail("rust-playground", `Rust playground unreachable: ${err instanceof Error ? err.message : String(err)}`, started);
  }
}

/** Official Go playground backend (no stdin support). */
async function runGoPlayground(code: string): Promise<RunResult> {
  const started = Date.now();
  try {
    const body = new URLSearchParams({ version: "2", body: code, withVet: "false" });
    const { res, data } = await fetchJson<{ Errors: string; Events: { Message: string; Kind: string }[] | null; Status?: number }>(
      "https://go.dev/_/compile?backend=",
      { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() },
    );
    if (!res.ok) return fail("go-playground", `HTTP ${res.status}`, started);
    if (data.Errors) {
      return { ok: false, engine: "go-playground", stdout: "", stderr: "", compileOutput: data.Errors, exitCode: 2, durationMs: Date.now() - started, timedOut: false };
    }
    let stdout = "";
    let stderr = "";
    for (const ev of data.Events ?? []) {
      if (ev.Kind === "stderr") stderr += ev.Message;
      else stdout += ev.Message;
    }
    const exitCode = data.Status ?? 0;
    const timedOut = /timeout running program/i.test(stderr);
    return { ok: exitCode === 0 && !timedOut, engine: "go-playground", stdout, stderr, compileOutput: "", exitCode, durationMs: Date.now() - started, timedOut };
  } catch (err) {
    return fail("go-playground", `Go playground unreachable: ${err instanceof Error ? err.message : String(err)}`, started);
  }
}

const WANDBOX: Record<TrackId, string> = {
  c: "gcc-13.2.0-c",
  rust: "rust-1.82.0",
  go: "go-1.23.2",
  php: "php-8.3.12",
  node: "nodejs-20.17.0",
  python: "cpython-3.13.8",
};

/** Wandbox – supports stdin for every language. */
async function runWandbox(track: TrackId, code: string, stdin: string): Promise<RunResult> {
  const started = Date.now();
  try {
    const payload: Record<string, string> = { compiler: WANDBOX[track], code, stdin };
    if (track === "c") payload["compiler-option-raw"] = "-std=c11\n-Wall\n-lm";
    const { res, data } = await fetchJson<{
      status?: string;
      signal?: string;
      compiler_output?: string;
      compiler_error?: string;
      program_output?: string;
      program_error?: string;
      error?: string;
    }>("https://wandbox.org/api/compile.json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok || data.error) return fail("wandbox", data.error ?? `Wandbox HTTP ${res.status}`, started);
    const exitCode = data.status !== undefined && data.status !== "" ? Number(data.status) : null;
    const timedOut = Boolean(data.signal && /KILL|TERM/i.test(data.signal));
    const compileOutput = (data.compiler_error ?? "") + (data.compiler_output ?? "");
    return {
      ok: exitCode === 0 && !timedOut,
      engine: "wandbox",
      stdout: data.program_output ?? "",
      stderr: (data.program_error ?? "") + (timedOut ? "\n[process killed: time limit exceeded]" : ""),
      compileOutput,
      exitCode,
      durationMs: Date.now() - started,
      timedOut,
    };
  } catch (err) {
    return fail("wandbox", `Wandbox unreachable: ${err instanceof Error ? err.message : String(err)}`, started);
  }
}

/** Self-hosted Piston instance (only used when PISTON_URL is configured). */
async function runPiston(track: TrackId, code: string, stdin: string): Promise<RunResult> {
  const started = Date.now();
  const cfg = PISTON_LANG[track];
  try {
    const { res, data } = await fetchJson<{
      compile?: { stdout: string; stderr: string; code: number | null; signal: string | null };
      run?: { stdout: string; stderr: string; code: number | null; signal: string | null };
      message?: string;
    }>(PISTON_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: cfg.language,
        version: "*",
        files: [{ name: cfg.file, content: code }],
        stdin,
        compile_timeout: COMPILE_TIMEOUT_MS,
        run_timeout: RUN_TIMEOUT_MS,
      }),
    });
    if (!res.ok || !data.run) return fail("piston", data.message ?? `Piston HTTP ${res.status}`, started);
    const compileFailed = Boolean(data.compile && data.compile.code !== 0 && data.compile.code !== null);
    const timedOut = data.run.signal === "SIGKILL";
    return {
      ok: !compileFailed && data.run.code === 0 && !timedOut,
      engine: "piston",
      stdout: data.run.stdout ?? "",
      stderr: (data.run.stderr ?? "") + (timedOut ? "\n[process killed: time limit exceeded]" : ""),
      compileOutput: data.compile ? data.compile.stderr || data.compile.stdout : "",
      exitCode: compileFailed ? data.compile!.code : data.run.code,
      durationMs: Date.now() - started,
      timedOut,
    };
  } catch (err) {
    return fail("piston", `Piston unreachable: ${err instanceof Error ? err.message : String(err)}`, started);
  }
}

/* ───────────────────────────────── public ───────────────────────────────── */

/** True when the result is a transport-level failure (service down) rather than a program failure. */
function isServiceFailure(r: RunResult): boolean {
  return !r.ok && r.exitCode === null && !r.timedOut && !r.compileOutput && !r.stdout;
}

export async function runCode(track: TrackId, code: string, stdin = ""): Promise<RunResult> {
  if (code.length > 100_000) return fail("local", "Program too large (limit 100 KB).", Date.now());

  // 1. Local toolchain – fastest and fully featured.
  const local = await runLocal(track, code, stdin).catch(() => null);
  if (local) return local;

  // 2. Self-hosted Piston if the operator configured one.
  if (PISTON_URL) {
    const r = await runPiston(track, code, stdin);
    if (!isServiceFailure(r)) return r;
  }

  // 3. Official language playgrounds (no stdin) → Wandbox (stdin ok).
  const attempts: RunResult[] = [];
  if (!stdin.trim()) {
    if (track === "rust") attempts.push(await runRustPlayground(code));
    if (track === "go") attempts.push(await runGoPlayground(code));
    const last = attempts[attempts.length - 1];
    if (last && !isServiceFailure(last)) return last;
  }
  const wb = await runWandbox(track, code, stdin);
  if (!isServiceFailure(wb)) return wb;

  const tried = [...attempts, wb].map((a) => `${a.engine}: ${a.stderr}`).join("\n");
  return fail("wandbox", `All execution engines failed.\n${tried}\n\nTip: install the toolchain on the server (gcc, rustc, go, php, node) for offline execution.`, Date.now());
}

export function isTrackId(v: unknown): v is TrackId {
  return typeof v === "string" && ["c", "rust", "go", "php", "node", "python"].includes(v);
}
