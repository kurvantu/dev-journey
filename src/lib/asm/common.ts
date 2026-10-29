import {
  DATA_BASE,
  MEM_SIZE,
  STACK_TOP,
  type AsmPlugin,
  type AssembledProgram,
  type Instruction,
  type Machine,
  type MachineError,
  type RegDef,
} from "./types";

export class AsmRuntimeError extends Error {}

export const maskOf = (bits: number) => (1n << BigInt(bits)) - 1n;
export const signBit = (bits: number) => 1n << BigInt(bits - 1);

export function toSigned(v: bigint, bits: number): bigint {
  const m = maskOf(bits);
  v &= m;
  return v >= signBit(bits) ? v - m - 1n : v;
}

/** Strip a trailing comment, respecting string literals. */
export function stripComment(line: string, starters: string[]): string {
  let inStr: string | false = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inStr) {
      if (c === inStr) inStr = false;
      continue;
    }
    if (c === "'" || c === '"') {
      inStr = c;
      continue;
    }
    for (const s of starters) {
      if (line.startsWith(s, i)) return line.slice(0, i);
    }
  }
  return line;
}

/** Split on commas at depth 0 (respects (), [], {} and strings). */
export function splitArgs(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  let inStr: string | false = false;
  for (const c of s) {
    if (inStr) {
      cur += c;
      if (c === inStr) inStr = false;
      continue;
    }
    if (c === "'" || c === '"') {
      inStr = c;
      cur += c;
      continue;
    }
    if (c === "[" || c === "{" || c === "(") depth++;
    if (c === "]" || c === "}" || c === ")") depth--;
    if (c === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const ESCAPES: Record<string, number> = { n: 10, t: 9, r: 13, "0": 0, "\\": 92, '"': 34, "'": 39 };

export function unescapeString(body: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "\\" && i + 1 < body.length && ESCAPES[body[i + 1]] !== undefined) {
      bytes.push(ESCAPES[body[i + 1]]);
      i++;
    } else {
      bytes.push(c.charCodeAt(0) & 0xff);
    }
  }
  return bytes;
}

/** Parse 0x1F, 1Fh, 101b, 42, -7, 'A', '\n'. Returns null when not a number. */
export function parseNumber(tok: string): bigint | null {
  tok = tok.trim();
  let neg = false;
  if (tok.startsWith("-")) {
    neg = true;
    tok = tok.slice(1).trim();
  }
  let v: bigint | null = null;
  const ch = /^'(\\?.)'$/.exec(tok);
  if (ch) {
    const bytes = unescapeString(ch[1]);
    v = BigInt(bytes[0] ?? 0);
  } else if (/^0x[0-9a-f]+$/i.test(tok)) v = BigInt(tok.toLowerCase());
  else if (/^[0-9][0-9a-f]*h$/i.test(tok)) v = BigInt("0x" + tok.slice(0, -1).toLowerCase());
  else if (/^[01]+b$/i.test(tok)) v = BigInt("0b" + tok.slice(0, -1));
  else if (/^\d+$/.test(tok)) v = BigInt(tok);
  if (v === null) return null;
  return neg ? -v : v;
}

/** Evaluate `a + b - c` where terms are numbers, symbols or `$`. */
export function evalExpr(expr: string, symbols: Map<string, bigint>, dollar: bigint): bigint {
  const parts = expr.trim().split(/(?<![+\-*])\s*([+-])\s*/);
  let total = 0n;
  let sign = 1n;
  for (const part of parts) {
    const p = part.trim();
    if (!p) continue;
    if (p === "+") {
      sign = 1n;
      continue;
    }
    if (p === "-") {
      sign = -1n;
      continue;
    }
    let v: bigint;
    if (p === "$") v = dollar;
    else {
      const n = parseNumber(p);
      if (n !== null) v = n;
      else {
        const s = symbols.get(p.toLowerCase());
        if (s === undefined) throw new AsmRuntimeError(`unknown symbol '${p}'`);
        v = s;
      }
    }
    total += sign * v;
    sign = 1n;
  }
  return total;
}

/* ───────────────────────────── virtual machine ───────────────────────────── */

export interface MachineOpts {
  /** canonical full-width registers and their bit width */
  fullRegs: Record<string, number>;
  /** every addressable register view (aliases included) */
  regDefs: Record<string, RegDef>;
  spReg: string;
  flagNames: string[];
  /** x86-64 rule: writing a 32-bit view zeroes the upper half */
  zeroExtend32: boolean;
  exec(m: BaseMachine, ins: Instruction): void;
}

const STEP_LIMIT = 2_000_000;

export class BaseMachine implements Machine {
  mem = new Uint8Array(MEM_SIZE);
  regs: Record<string, bigint> = {};
  flags: Record<string, boolean> = {};
  output = "";
  halted = false;
  haltNote: string | null = null;
  exitCode: number | null = null;
  steps = 0;
  ip = 0;
  error: MachineError | null = null;
  lastChanged = new Set<string>();
  lastMem: { addr: number; len: number } | null = null;
  initialSp = STACK_TOP;

  constructor(
    public plugin: AsmPlugin,
    public prog: AssembledProgram,
    public opts: MachineOpts,
  ) {
    for (const r of Object.keys(opts.fullRegs)) this.regs[r] = 0n;
    for (const f of opts.flagNames) this.flags[f] = false;
    this.mem.set(prog.data.slice(0, MEM_SIZE - DATA_BASE), DATA_BASE);
    this.writeReg(opts.spReg, BigInt(STACK_TOP));
    this.lastChanged.clear();
    const entry = prog.labels.get("_start") ?? prog.labels.get("start") ?? prog.labels.get("main");
    if (entry !== undefined) this.ip = entry;
  }

  fullOf(name: string): string {
    return this.opts.regDefs[name.toLowerCase()]?.full ?? name.toLowerCase();
  }

  readReg(name: string): bigint {
    const d = this.opts.regDefs[name.toLowerCase()];
    if (!d) throw new AsmRuntimeError(`unknown register '${name}'`);
    return (this.regs[d.full] >> BigInt(d.shift)) & maskOf(d.bits);
  }

  writeReg(name: string, v: bigint): void {
    const d = this.opts.regDefs[name.toLowerCase()];
    if (!d) throw new AsmRuntimeError(`unknown register '${name}'`);
    const fullBits = this.opts.fullRegs[d.full];
    v &= maskOf(d.bits);
    if (this.opts.zeroExtend32 && d.bits === 32 && fullBits === 64 && d.shift === 0) {
      this.regs[d.full] = v; // x86-64: eax write clears upper rax
    } else if (d.bits === fullBits) {
      this.regs[d.full] = v;
    } else {
      const m = maskOf(d.bits) << BigInt(d.shift);
      this.regs[d.full] = (this.regs[d.full] & ~m) | (v << BigInt(d.shift));
    }
    this.lastChanged.add(d.full);
  }

  spValue(): number {
    return Number(this.readReg(this.opts.spReg));
  }

  checkAddr(addr: number, size: number) {
    if (!Number.isInteger(addr) || addr < 0 || addr + size > MEM_SIZE) {
      throw new AsmRuntimeError(`memory access out of bounds: 0x${(addr >>> 0).toString(16)} (${size} bytes)`);
    }
  }

  readMem(addr: number, size: number): bigint {
    this.checkAddr(addr, size);
    let v = 0n;
    for (let i = size - 1; i >= 0; i--) v = (v << 8n) | BigInt(this.mem[addr + i]);
    return v;
  }

  writeMem(addr: number, size: number, v: bigint): void {
    this.checkAddr(addr, size);
    for (let i = 0; i < size; i++) {
      this.mem[addr + i] = Number((v >> BigInt(8 * i)) & 0xffn);
    }
    this.lastMem = { addr, len: size };
  }

  readString(addr: number, terminator: number | null, maxLen: number): string {
    let out = "";
    for (let i = 0; i < maxLen; i++) {
      this.checkAddr(addr + i, 1);
      const b = this.mem[addr + i];
      if (terminator !== null && b === terminator) break;
      out += String.fromCharCode(b);
    }
    return out;
  }

  halt(code: number | null, note: string | null = null) {
    this.halted = true;
    this.exitCode = code;
    this.haltNote = note;
  }

  step(): void {
    if (this.halted || this.error) return;
    const ins = this.prog.instructions[this.ip];
    this.lastChanged = new Set();
    this.lastMem = null;
    if (!ins) {
      this.halt(null, "fell off the end of the program — add an explicit exit");
      return;
    }
    try {
      this.opts.exec(this, ins);
    } catch (e) {
      this.error = { line: ins.line, message: e instanceof Error ? e.message : String(e) };
    }
    this.steps++;
    if (this.steps > STEP_LIMIT && !this.halted) {
      this.error = { line: ins.line, message: `execution limit of ${STEP_LIMIT.toLocaleString()} steps reached — possible infinite loop` };
    }
  }
}
