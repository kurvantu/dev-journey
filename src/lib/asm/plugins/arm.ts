/**
 * ARM (ARMv7-style, 32-bit) — shipped as a PLUGIN.
 *
 * This file lives outside the core engine and registers itself through the
 * same public interface any third-party architecture would use. Nothing in
 * the playground UI knows ARM exists until the registry hands it over.
 */
import {
  AsmRuntimeError,
  BaseMachine,
  evalExpr,
  maskOf,
  parseNumber,
  signBit,
  splitArgs,
  stripComment,
  toSigned,
  unescapeString,
} from "../common";
import {
  DATA_BASE,
  addrOfIndex,
  indexOfAddr,
  type AsmError,
  type AsmPlugin,
  type AssembledProgram,
  type Instruction,
  type Operand,
  type RegDef,
} from "../types";

const W = 32;
const MASK = maskOf(W);

/* registers r0..r15 + aliases */
const fullRegs: Record<string, number> = {};
const regDefs: Record<string, RegDef> = {};
for (let i = 0; i <= 15; i++) {
  const r = `r${i}`;
  fullRegs[r] = 32;
  regDefs[r] = { full: r, shift: 0, bits: 32 };
}
regDefs["sp"] = { full: "r13", shift: 0, bits: 32 };
regDefs["lr"] = { full: "r14", shift: 0, bits: 32 };
regDefs["pc"] = { full: "r15", shift: 0, bits: 32 };
regDefs["fp"] = { full: "r11", shift: 0, bits: 32 };

const COND: Record<string, (f: Record<string, boolean>) => boolean> = {
  eq: (f) => f.Z,
  ne: (f) => !f.Z,
  gt: (f) => !f.Z && f.N === f.V,
  ge: (f) => f.N === f.V,
  lt: (f) => f.N !== f.V,
  le: (f) => f.Z || f.N !== f.V,
  hi: (f) => f.C && !f.Z,
  ls: (f) => !f.C || f.Z,
  lo: (f) => !f.C,
  cc: (f) => !f.C,
  cs: (f) => f.C,
  hs: (f) => f.C,
  mi: (f) => f.N,
  pl: (f) => !f.N,
  al: () => true,
};

const BRANCHES = new Set(["b", "bl", ...Object.keys(COND).map((c) => "b" + c)]);
const KNOWN = new Set([
  "mov", "movs", "mvn", "mvns",
  "add", "adds", "sub", "subs", "rsb", "rsbs", "mul", "muls",
  "and", "ands", "orr", "orrs", "eor", "eors", "bic", "bics",
  "lsl", "lsls", "lsr", "lsrs", "asr", "asrs",
  "cmp", "cmn", "tst", "teq",
  "ldr", "ldrb", "str", "strb",
  "push", "pop", "bx", "svc", "swi", "nop",
  ...BRANCHES,
]);

/* ──────────────────────────────── assembler ──────────────────────────────── */

function assembleArm(src: string): AssembledProgram {
  const lines = src.split(/\r?\n/);
  const errors: AsmError[] = [];
  const symbols = new Map<string, bigint>();
  const dataBytes: number[] = [];
  const codeLines: { line: number; text: string }[] = [];
  let section: "text" | "data" = "text";

  const pushData = (directive: string, rest: string, line: number) => {
    const d = directive.toLowerCase();
    if (d === ".asciz" || d === ".ascii" || d === ".string") {
      const m = /^"([\s\S]*)"$/.exec(rest.trim());
      if (!m) {
        errors.push({ line, message: `${d} expects a double-quoted string` });
        return;
      }
      for (const b of unescapeString(m[1])) dataBytes.push(b);
      if (d !== ".ascii") dataBytes.push(0);
      return;
    }
    const size = d === ".word" || d === ".int" ? 4 : d === ".hword" || d === ".short" ? 2 : d === ".byte" ? 1 : null;
    if (size !== null) {
      for (const item of splitArgs(rest)) {
        try {
          let v = evalExpr(item, symbols, BigInt(DATA_BASE + dataBytes.length));
          for (let i = 0; i < size; i++) {
            dataBytes.push(Number(v & 0xffn));
            v >>= 8n;
          }
        } catch (e) {
          errors.push({ line, message: e instanceof Error ? e.message : String(e) });
        }
      }
      return;
    }
    if (d === ".space" || d === ".skip") {
      const n = Number(parseNumber(rest.trim()) ?? 0n);
      for (let i = 0; i < n; i++) dataBytes.push(0);
      return;
    }
    errors.push({ line, message: `unknown data directive '${directive}'` });
  };

  // Pass A
  for (let i = 0; i < lines.length; i++) {
    const text = stripComment(lines[i], [";", "@", "//"]).trim();
    if (!text) continue;
    const low = text.toLowerCase();
    if (low === ".data") { section = "data"; continue; }
    if (low === ".text" || low === ".code") { section = "text"; continue; }
    if (/^\.(global|globl|align|balign|arch|cpu|syntax|thumb|arm|extern)\b/.test(low)) continue;
    const equ = /^\.equ\s+([\w.]+)\s*,\s*(.+)$/i.exec(text);
    if (equ) {
      try {
        symbols.set(equ[1].toLowerCase(), evalExpr(equ[2], symbols, BigInt(DATA_BASE + dataBytes.length)));
      } catch (e) {
        errors.push({ line: i + 1, message: e instanceof Error ? e.message : String(e) });
      }
      continue;
    }

    if (section === "data") {
      const m = /^(?:([A-Za-z_.][\w.]*)\s*:\s*)?(\.\w+)?\s*(.*)$/.exec(text)!;
      if (m[1]) symbols.set(m[1].toLowerCase(), BigInt(DATA_BASE + dataBytes.length));
      if (m[2]) pushData(m[2], m[3] ?? "", i + 1);
      else if (m[3]) errors.push({ line: i + 1, message: `expected a data directive, got '${m[3]}'` });
      continue;
    }
    codeLines.push({ line: i + 1, text });
  }

  // Pass B
  const instructions: Instruction[] = [];
  const labels = new Map<string, number>();

  const parseOperand = (tok: string, line: number): Operand => {
    tok = tok.trim();
    const lower = tok.toLowerCase();
    if (lower.startsWith("#")) {
      const n = parseNumber(lower.slice(1).trim()) ?? (symbols.has(lower.slice(1).trim()) ? symbols.get(lower.slice(1).trim())! : null);
      if (n === null) {
        errors.push({ line, message: `bad immediate '${tok}'` });
        return { k: "imm", v: 0n };
      }
      return { k: "imm", v: n };
    }
    if (lower.startsWith("=")) {
      const body = lower.slice(1).trim();
      const n = parseNumber(body);
      if (n !== null) return { k: "imm", v: n };
      const sym = symbols.get(body);
      if (sym !== undefined) return { k: "imm", v: sym };
      return { k: "label", name: body }; // resolved in finalize
    }
    if (tok.startsWith("{") && tok.endsWith("}")) {
      const list = splitArgs(tok.slice(1, -1)).map((r) => r.trim().toLowerCase());
      for (const r of list) if (!regDefs[r]) errors.push({ line, message: `unknown register '${r}' in list` });
      return { k: "list", list };
    }
    if (tok.startsWith("[") && tok.endsWith("]")) {
      const parts = splitArgs(tok.slice(1, -1));
      const base = parts[0]?.trim().toLowerCase();
      if (!base || !regDefs[base]) {
        errors.push({ line, message: `bad memory operand '${tok}'` });
        return { k: "mem", disp: 0n };
      }
      let disp = 0n;
      let index: string | undefined;
      if (parts[1]) {
        const p = parts[1].trim().toLowerCase();
        if (p.startsWith("#")) disp = parseNumber(p.slice(1)) ?? 0n;
        else if (regDefs[p]) index = p;
        else errors.push({ line, message: `bad offset '${parts[1]}'` });
      }
      return { k: "mem", base, index, disp };
    }
    if (regDefs[lower]) return { k: "reg", name: lower };
    const n = parseNumber(lower);
    if (n !== null) return { k: "imm", v: n };
    return { k: "label", name: lower };
  };

  for (const { line, text } of codeLines) {
    let rest = text;
    const lbl = /^([A-Za-z_.][\w.]*)\s*:\s*(.*)$/.exec(rest);
    if (lbl) {
      labels.set(lbl[1].toLowerCase(), instructions.length);
      rest = lbl[2].trim();
    }
    if (!rest) continue;
    const sp = rest.search(/\s/);
    const op = (sp === -1 ? rest : rest.slice(0, sp)).toLowerCase();
    const argStr = sp === -1 ? "" : rest.slice(sp + 1).trim();
    if (!KNOWN.has(op)) {
      errors.push({ line, message: `unknown instruction '${op}'` });
      continue;
    }
    instructions.push({ op, ops: splitArgs(argStr).map((a) => parseOperand(a, line)), line, raw: text });
  }

  // Finalize label operands
  for (const ins of instructions) {
    for (let i = 0; i < ins.ops.length; i++) {
      const o = ins.ops[i];
      if (o.k !== "label" || !o.name) continue;
      if (BRANCHES.has(ins.op)) {
        if (!labels.has(o.name)) errors.push({ line: ins.line, message: `unknown label '${o.name}'` });
        continue;
      }
      const sym = symbols.get(o.name);
      if (sym !== undefined) ins.ops[i] = { k: "imm", v: sym };
      else if (labels.has(o.name)) ins.ops[i] = { k: "imm", v: BigInt(addrOfIndex(labels.get(o.name)!)) };
      else errors.push({ line: ins.line, message: `unknown symbol '${o.name}'` });
    }
  }

  return { instructions, labels, symbols, data: Uint8Array.from(dataBytes), dataBase: DATA_BASE, errors, lines };
}

/* ──────────────────────────────── executor ──────────────────────────────── */

function exec(m: BaseMachine, ins: Instruction): void {
  const f = m.flags;
  let next = m.ip + 1;

  const get = (o: Operand): bigint => {
    if (o.k === "reg") return o.name === "pc" || o.name === "r15" ? BigInt(addrOfIndex(m.ip)) : m.readReg(o.name!);
    if (o.k === "imm") return o.v! & MASK;
    throw new AsmRuntimeError(`operand must be a register or #immediate`);
  };
  const setReg = (o: Operand, v: bigint) => {
    if (o.k !== "reg") throw new AsmRuntimeError("destination must be a register");
    if (o.name === "pc" || o.name === "r15") {
      const idx = indexOfAddr(Number(v & MASK));
      if (idx === null) throw new AsmRuntimeError(`jump to invalid address 0x${Number(v).toString(16)}`);
      next = idx;
      return;
    }
    m.writeReg(o.name!, v);
  };
  const effAddr = (o: Operand): number => {
    if (o.k !== "mem") throw new AsmRuntimeError("expected a memory operand like [r1] or [r1, #4]");
    let a = m.readReg(o.base!) + (o.disp ?? 0n);
    if (o.index) a += m.readReg(o.index);
    return Number(a & MASK);
  };
  const branch = (o: Operand): number => {
    const idx = m.prog.labels.get(o.name ?? "");
    if (idx === undefined) throw new AsmRuntimeError(`unknown label '${o.name}'`);
    return idx;
  };
  const setNZ = (r: bigint) => {
    f.N = (r & signBit(W)) !== 0n;
    f.Z = r === 0n;
  };
  const addFlags = (a: bigint, b: bigint, r: bigint) => {
    f.C = a + b > MASK;
    f.V = (~(a ^ b) & (a ^ r) & signBit(W)) !== 0n;
    setNZ(r);
  };
  const subFlags = (a: bigint, b: bigint, r: bigint) => {
    f.C = a >= b; // ARM carry = NOT borrow
    f.V = ((a ^ b) & (a ^ r) & signBit(W)) !== 0n;
    setNZ(r);
  };

  const [d, s1, s2] = ins.ops;
  const op = ins.op;
  const setsFlags = op.endsWith("s") && op !== "bics"; // bics also sets; handled below
  const base = op.endsWith("s") && KNOWN.has(op.slice(0, -1)) ? op.slice(0, -1) : op;

  const alu3 = (fn: (a: bigint, b: bigint) => bigint, flagKind: "add" | "sub" | "logic" | "rsb") => {
    const a = s2 ? get(s1) : get(d);
    const b = s2 ? get(s2) : get(s1);
    const x = flagKind === "rsb" ? b : a;
    const y = flagKind === "rsb" ? a : b;
    const r = fn(x, y) & MASK;
    if (setsFlags || op.endsWith("s")) {
      if (flagKind === "add") addFlags(x, y, r);
      else if (flagKind === "sub" || flagKind === "rsb") subFlags(x, y, r);
      else setNZ(r);
    }
    setReg(d, r);
  };

  switch (base) {
    case "nop": break;
    case "mov": {
      const r = get(s1) & MASK;
      if (op.endsWith("s")) setNZ(r);
      setReg(d, r);
      break;
    }
    case "mvn": {
      const r = ~get(s1) & MASK;
      if (op.endsWith("s")) setNZ(r);
      setReg(d, r);
      break;
    }
    case "add": alu3((a, b) => a + b, "add"); break;
    case "sub": alu3((a, b) => a - b, "sub"); break;
    case "rsb": alu3((a, b) => a - b, "rsb"); break;
    case "mul": {
      const r = (get(s1) * get(s2 ?? s1)) & MASK;
      if (op.endsWith("s")) setNZ(r);
      setReg(d, r);
      break;
    }
    case "and": alu3((a, b) => a & b, "logic"); break;
    case "orr": alu3((a, b) => a | b, "logic"); break;
    case "eor": alu3((a, b) => a ^ b, "logic"); break;
    case "bic": alu3((a, b) => a & ~b, "logic"); break;
    case "lsl": alu3((a, b) => a << (b & 31n), "logic"); break;
    case "lsr": alu3((a, b) => a >> (b & 31n), "logic"); break;
    case "asr": alu3((a, b) => toSigned(a, W) >> (b & 31n), "logic"); break;

    case "cmp": { const a = get(d); const b = get(s1); subFlags(a, b, (a - b) & MASK); break; }
    case "cmn": { const a = get(d); const b = get(s1); addFlags(a, b, (a + b) & MASK); break; }
    case "tst": { setNZ(get(d) & get(s1)); break; }
    case "teq": { setNZ((get(d) ^ get(s1)) & MASK); break; }

    case "ldr": case "ldrb": {
      if (s1.k === "imm") { setReg(d, s1.v! & MASK); break; } // ldr rd, =value
      setReg(d, m.readMem(effAddr(s1), base === "ldrb" ? 1 : 4));
      break;
    }
    case "str": case "strb": {
      m.writeMem(effAddr(s1), base === "strb" ? 1 : 4, get(d));
      break;
    }

    case "push": {
      const list = [...(d.list ?? [])].sort((a, b) => regNum(a) - regNum(b));
      let sp = Number(m.readReg("sp")) - 4 * list.length;
      m.writeReg("sp", BigInt(sp));
      for (const r of list) {
        m.writeMem(sp, 4, r === "lr" || r === "r14" ? m.readReg("r14") : m.readReg(r));
        sp += 4;
      }
      break;
    }
    case "pop": {
      const list = [...(d.list ?? [])].sort((a, b) => regNum(a) - regNum(b));
      let sp = Number(m.readReg("sp"));
      for (const r of list) {
        const v = m.readMem(sp, 4);
        sp += 4;
        if (r === "pc" || r === "r15") {
          const idx = indexOfAddr(Number(v));
          if (idx === null) throw new AsmRuntimeError(`pop {pc}: invalid return address 0x${Number(v).toString(16)}`);
          next = idx;
        } else m.writeReg(r, v);
      }
      m.writeReg("sp", BigInt(sp));
      break;
    }

    case "bx": {
      const idx = indexOfAddr(Number(get(d) & MASK));
      if (idx === null) throw new AsmRuntimeError("bx: invalid address in register (did you set lr with bl?)");
      next = idx;
      break;
    }
    case "svc": case "swi": {
      const n = Number(m.readReg("r7"));
      if (n === 4) {
        m.output += m.readString(Number(m.readReg("r1")), null, Number(m.readReg("r2")));
        m.writeReg("r0", m.readReg("r2"));
      } else if (n === 1) {
        m.halt(Number(m.readReg("r0")), "exit (svc #0, r7=1)");
        return;
      } else {
        throw new AsmRuntimeError(`svc: r7=${n} not supported (4 = write, 1 = exit)`);
      }
      break;
    }

    default: {
      if (op === "b") { next = branch(d); break; }
      if (op === "bl") {
        m.writeReg("r14", BigInt(addrOfIndex(next)));
        next = branch(d);
        break;
      }
      if (op.startsWith("b") && COND[op.slice(1)]) {
        if (COND[op.slice(1)](f)) next = branch(d);
        break;
      }
      throw new AsmRuntimeError(`unhandled instruction '${op}'`);
    }
  }
  m.ip = next;
}

function regNum(name: string): number {
  const d = regDefs[name];
  return d ? parseInt(d.full.slice(1), 10) : 99;
}

/* ──────────────────────────────── examples ──────────────────────────────── */

const EX_HELLO = `@ ── Hello from ARM (Linux EABI svc) ────────────────
.data
msg:    .asciz "Hello from ARM!\\n"
.text
_start:
    mov r7, #4          @ syscall 4 = write
    mov r0, #1          @ fd 1 = stdout
    ldr r1, =msg        @ r1 -> message
    mov r2, #16         @ length
    svc #0
    mov r7, #1          @ syscall 1 = exit
    mov r0, #0
    svc #0
`;

const EX_SUM = `@ ── Sum 1..10 with a flag-setting loop ─────────────
@ subs updates NZCV; bne branches while Z is clear.
.data
result: .word 0
.text
_start:
    mov r0, #0          @ sum
    mov r1, #10         @ counter
loop:
    add r0, r0, r1
    subs r1, r1, #1
    bne loop            @ r0 = 55
    ldr r3, =result
    str r0, [r3]        @ watch the data segment change
    mov r7, #1
    svc #0              @ exit code 55
`;

const EX_FIB = `@ ── Fibonacci stored to memory word by word ────────
.data
fib:    .space 40
.text
_start:
    mov r0, #0          @ a
    mov r1, #1          @ b
    mov r2, #10         @ count
    ldr r3, =fib
next:
    str r0, [r3]
    add r3, r3, #4
    add r4, r0, r1      @ t = a + b
    mov r0, r1
    mov r1, r4
    subs r2, r2, #1
    bne next
    mov r7, #1
    mov r0, #0
    svc #0
`;

const EX_CALL = `@ ── bl / bx lr: the ARM calling convention ─────────
_start:
    mov r0, #5
    bl triple           @ lr = return address
    mov r7, #1          @ exit code = r0 = 15
    svc #0

triple:
    push {r4, lr}       @ callee saves what it uses
    add r4, r0, r0      @ r4 = 2n
    add r0, r4, r0      @ r0 = 3n
    pop {r4, pc}        @ restoring pc returns
`;

/* ──────────────────────────────── plugin ──────────────────────────────── */

const regBits: Record<string, number> = {};
for (const name of Object.keys(regDefs)) regBits[name] = 32;

export const armPlugin: AsmPlugin = {
  id: "arm",
  name: "ARM (32-bit)",
  subtitle: "ARMv7-style · Linux EABI svc — loaded as a plugin",
  origin: "plugin",
  bits: 32,
  sp: "sp",
  registerGroups: [
    { title: "Arguments / results", regs: ["r0", "r1", "r2", "r3"] },
    { title: "Variables (r7 = syscall #)", regs: ["r4", "r5", "r6", "r7"] },
    { title: "Scratch", regs: ["r8", "r9", "r10", "r11", "r12"] },
    { title: "Special", regs: ["sp", "lr"] },
  ],
  regBits,
  flagNames: ["N", "Z", "C", "V"],
  syntaxNote:
    "UAL syntax: `op rd, rn, operand2`. Immediates need `#` (mov r0, #1). `ldr r0, =label` loads an address. Only instructions ending in `s` (or cmp/tst) touch the NZCV flags.",
  examples: [
    { name: "Hello svc", code: EX_HELLO },
    { name: "Sum + flags loop", code: EX_SUM },
    { name: "Fibonacci in memory", code: EX_FIB },
    { name: "bl / bx lr calls", code: EX_CALL },
  ],
  reference: [
    { syntax: "mov/mvn rd, op2", desc: "Copy / bitwise-NOT copy. op2 = reg or #imm" },
    { syntax: "add/sub/rsb rd, rn, op2", desc: "Arithmetic. rsb = reversed subtract (op2 − rn)" },
    { syntax: "adds/subs/movs …", desc: "The `s` suffix updates the NZCV flags" },
    { syntax: "cmp/cmn/tst rn, op2", desc: "Flags only: compare, negated compare, bit test" },
    { syntax: "and/orr/eor/bic rd, rn, op2", desc: "Logic ops (bic = AND NOT)" },
    { syntax: "lsl/lsr/asr rd, rm, #n", desc: "Shifts; asr keeps the sign" },
    { syntax: "mul rd, rm, rs", desc: "32-bit multiply" },
    { syntax: "b / beq / bne / bgt / blt … label", desc: "Branch (conditionally) — reads the flags" },
    { syntax: "bl label · bx lr", desc: "Call (saves return in lr) · return" },
    { syntax: "ldr/str rd, [rn, #off]", desc: "Load/store a word; ldrb/strb for one byte" },
    { syntax: "ldr rd, =label", desc: "Pseudo-instruction: load an address or constant" },
    { syntax: "push {r4, lr} · pop {r4, pc}", desc: "Stack; popping into pc returns" },
    { syntax: "svc #0", desc: "r7=4 write(r0,r1,r2) · r7=1 exit(r0)" },
    { syntax: '.data · msg: .asciz "hi\\n" · .word 1,2', desc: "Data directives (.ascii, .byte, .space also work)" },
  ],
  assemble: assembleArm,
  createMachine(prog) {
    return new BaseMachine(armPlugin, prog, {
      fullRegs,
      regDefs,
      spReg: "sp",
      flagNames: ["N", "Z", "C", "V"],
      zeroExtend32: false,
      exec,
    });
  },
};
