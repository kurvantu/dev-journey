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
} from "./common";
import {
  DATA_BASE,
  addrOfIndex,
  indexOfAddr,
  type AsmError,
  type AsmPlugin,
  type AssembledProgram,
  type Instruction,
  type Operand,
  type OperandSize,
  type RegDef,
} from "./types";

/* ───────────────────────────── register files ───────────────────────────── */

function buildRegs(bits: 32 | 64) {
  const fullRegs: Record<string, number> = {};
  const regDefs: Record<string, RegDef> = {};
  const gp = ["ax", "bx", "cx", "dx", "si", "di", "bp", "sp"];

  if (bits === 64) {
    for (const r of gp) {
      const full = "r" + r;
      fullRegs[full] = 64;
      regDefs[full] = { full, shift: 0, bits: 64 };
      regDefs["e" + r] = { full, shift: 0, bits: 32 };
      regDefs[r] = { full, shift: 0, bits: 16 };
    }
    for (const r of ["ax", "bx", "cx", "dx"]) {
      const full = "r" + r;
      regDefs[r[0] + "l"] = { full, shift: 0, bits: 8 };
      regDefs[r[0] + "h"] = { full, shift: 8, bits: 8 };
    }
    regDefs["sil"] = { full: "rsi", shift: 0, bits: 8 };
    regDefs["dil"] = { full: "rdi", shift: 0, bits: 8 };
    for (let i = 8; i <= 15; i++) {
      const full = `r${i}`;
      fullRegs[full] = 64;
      regDefs[full] = { full, shift: 0, bits: 64 };
      regDefs[`r${i}d`] = { full, shift: 0, bits: 32 };
      regDefs[`r${i}w`] = { full, shift: 0, bits: 16 };
      regDefs[`r${i}b`] = { full, shift: 0, bits: 8 };
    }
  } else {
    for (const r of gp) {
      const full = "e" + r;
      fullRegs[full] = 32;
      regDefs[full] = { full, shift: 0, bits: 32 };
      regDefs[r] = { full, shift: 0, bits: 16 };
    }
    for (const r of ["ax", "bx", "cx", "dx"]) {
      const full = "e" + r;
      regDefs[r[0] + "l"] = { full, shift: 0, bits: 8 };
      regDefs[r[0] + "h"] = { full, shift: 8, bits: 8 };
    }
    for (const seg of ["ds", "es"]) {
      fullRegs[seg] = 16;
      regDefs[seg] = { full: seg, shift: 0, bits: 16 };
    }
  }
  return { fullRegs, regDefs };
}

/* ─────────────────────────── instruction tables ─────────────────────────── */

const JCC: Record<string, (f: Record<string, boolean>) => boolean> = {
  je: (f) => f.ZF,
  jz: (f) => f.ZF,
  jne: (f) => !f.ZF,
  jnz: (f) => !f.ZF,
  jg: (f) => !f.ZF && f.SF === f.OF,
  jnle: (f) => !f.ZF && f.SF === f.OF,
  jge: (f) => f.SF === f.OF,
  jl: (f) => f.SF !== f.OF,
  jle: (f) => f.ZF || f.SF !== f.OF,
  ja: (f) => !f.CF && !f.ZF,
  jae: (f) => !f.CF,
  jb: (f) => f.CF,
  jbe: (f) => f.CF || f.ZF,
  jc: (f) => f.CF,
  jnc: (f) => !f.CF,
  js: (f) => f.SF,
  jns: (f) => !f.SF,
  jo: (f) => f.OF,
  jno: (f) => !f.OF,
};

const JUMP_OPS = new Set(["jmp", "call", "loop", ...Object.keys(JCC)]);

const KNOWN_OPS = new Set([
  "mov", "lea", "xchg", "movzx", "movsx",
  "add", "sub", "inc", "dec", "neg", "cmp", "test",
  "and", "or", "xor", "not",
  "shl", "sal", "shr", "sar",
  "mul", "imul", "div", "idiv", "cdq", "cqo",
  "push", "pop", "call", "ret", "jmp", "loop",
  "nop", "hlt", "int", "syscall",
  ...Object.keys(JCC),
]);

const SIZE_KEYWORDS: Record<string, OperandSize> = { byte: 1, word: 2, dword: 4, qword: 8 };

/* ──────────────────────────────── assembler ──────────────────────────────── */

function assembleX86(src: string, bits: 32 | 64, regDefs: Record<string, RegDef>): AssembledProgram {
  const lines = src.split(/\r?\n/);
  const errors: AsmError[] = [];
  const symbols = new Map<string, bigint>();
  const dataBytes: number[] = [];
  const codeLines: { line: number; text: string }[] = [];
  let section: "text" | "data" = "text";

  symbols.set("@data", BigInt(DATA_BASE >> 4));

  const dataSizes: Record<string, OperandSize> = { db: 1, dw: 2, dd: 4, dq: 8 };

  const pushItem = (item: string, size: OperandSize, line: number) => {
    item = item.trim();
    const dup = /^(\d+)\s+dup\s*\((.*)\)$/i.exec(item);
    if (dup) {
      const n = parseInt(dup[1], 10);
      for (let i = 0; i < n; i++) pushItem(dup[2], size, line);
      return;
    }
    if ((item.startsWith("'") && item.endsWith("'") && item.length > 2) || (item.startsWith('"') && item.endsWith('"'))) {
      const bytes = unescapeString(item.slice(1, -1));
      if (size === 1) for (const b of bytes) dataBytes.push(b);
      else for (const b of bytes) { let v = BigInt(b); for (let i = 0; i < size; i++) { dataBytes.push(Number(v & 0xffn)); v >>= 8n; } }
      return;
    }
    if (item === "?") item = "0";
    try {
      let v = evalExpr(item, symbols, BigInt(DATA_BASE + dataBytes.length));
      for (let i = 0; i < size; i++) {
        dataBytes.push(Number(v & 0xffn));
        v >>= 8n;
      }
    } catch (e) {
      errors.push({ line, message: e instanceof Error ? e.message : String(e) });
    }
  };

  // Pass A – sections, data, symbols
  for (let i = 0; i < lines.length; i++) {
    const text = stripComment(lines[i], [";"]).trim();
    if (!text) continue;
    const low = text.toLowerCase();

    if (low === ".data" || low === "section .data" || low === ".data?") { section = "data"; continue; }
    if (low === ".code" || low === ".text" || low === "section .text" || low === "section .code") { section = "text"; continue; }
    if (/^\.(model|stack|386|486|586|686|radix|const)\b/.test(low)) continue;
    if (/^(end|assume|org|global|extern|public|%include)\b/.test(low)) continue;

    if (section === "data") {
      const equ = /^([\w@$?.]+)\s+equ\s+(.+)$/i.exec(text);
      if (equ) {
        try {
          symbols.set(equ[1].toLowerCase(), evalExpr(equ[2], symbols, BigInt(DATA_BASE + dataBytes.length)));
        } catch (e) {
          errors.push({ line: i + 1, message: e instanceof Error ? e.message : String(e) });
        }
        continue;
      }
      const m = /^(?:([A-Za-z_@$?.][\w@$?.]*)\s*:?\s+)?(db|dw|dd|dq)\s+(.+)$/i.exec(text);
      if (!m) {
        errors.push({ line: i + 1, message: `cannot parse data definition: '${text}'` });
        continue;
      }
      if (m[1]) symbols.set(m[1].toLowerCase(), BigInt(DATA_BASE + dataBytes.length));
      const size = dataSizes[m[2].toLowerCase()];
      for (const item of splitArgs(m[3])) pushItem(item, size, i + 1);
      continue;
    }

    // equ allowed in code section too
    const equ = /^([\w@$?.]+)\s+equ\s+(.+)$/i.exec(text);
    if (equ) {
      try {
        symbols.set(equ[1].toLowerCase(), evalExpr(equ[2], symbols, BigInt(DATA_BASE + dataBytes.length)));
      } catch (e) {
        errors.push({ line: i + 1, message: e instanceof Error ? e.message : String(e) });
      }
      continue;
    }
    codeLines.push({ line: i + 1, text });
  }

  // Pass B – instructions & labels
  const instructions: Instruction[] = [];
  const labels = new Map<string, number>();

  const parseOperand = (tok: string, line: number): Operand => {
    tok = tok.trim();
    let size: OperandSize | undefined;
    const sz = /^(byte|word|dword|qword)\s+ptr\s+(.*)$/i.exec(tok);
    if (sz) {
      size = SIZE_KEYWORDS[sz[1].toLowerCase()];
      tok = sz[2].trim();
    }
    const off = /^offset\s+(.+)$/i.exec(tok);
    if (off) return { k: "label", name: off[1].trim().toLowerCase() };

    if (tok.startsWith("[") && tok.endsWith("]")) {
      const inner = tok.slice(1, -1);
      const op: Operand = { k: "mem", disp: 0n, size };
      const parts = inner.split(/(?=[+-])/);
      for (let raw of parts) {
        let sign = 1n;
        raw = raw.trim();
        if (raw.startsWith("+")) raw = raw.slice(1).trim();
        else if (raw.startsWith("-")) { sign = -1n; raw = raw.slice(1).trim(); }
        const lower = raw.toLowerCase();
        if (regDefs[lower]) {
          if (sign < 0n) { errors.push({ line, message: `cannot subtract a register in '[${inner}]'` }); continue; }
          if (!op.base) op.base = lower;
          else if (!op.index) op.index = lower;
          else errors.push({ line, message: `too many registers in '[${inner}]'` });
          continue;
        }
        const n = parseNumber(raw);
        if (n !== null) { op.disp = (op.disp ?? 0n) + sign * n; continue; }
        const sym = symbols.get(lower);
        if (sym !== undefined) { op.disp = (op.disp ?? 0n) + sign * sym; continue; }
        errors.push({ line, message: `unknown term '${raw}' in memory operand` });
      }
      return op;
    }

    const n = parseNumber(tok);
    if (n !== null) return { k: "imm", v: n };
    const lower = tok.toLowerCase();
    if (regDefs[lower]) return { k: "reg", name: lower, size };
    return { k: "label", name: lower };
  };

  for (const { line, text } of codeLines) {
    let rest = text;
    const lbl = /^([A-Za-z_@$?.][\w@$?.]*)\s*:\s*(.*)$/.exec(rest);
    if (lbl) {
      labels.set(lbl[1].toLowerCase(), instructions.length);
      rest = lbl[2].trim();
    } else {
      const proc = /^([A-Za-z_@$?.][\w@$?.]*)\s+proc\b/i.exec(rest);
      if (proc) { labels.set(proc[1].toLowerCase(), instructions.length); continue; }
      if (/^[\w@$?.]+\s+endp\b/i.test(rest) || /^ends\b/i.test(rest)) continue;
    }
    if (!rest) continue;
    const sp = rest.search(/\s/);
    const op = (sp === -1 ? rest : rest.slice(0, sp)).toLowerCase();
    const argStr = sp === -1 ? "" : rest.slice(sp + 1).trim();
    if (!KNOWN_OPS.has(op)) {
      errors.push({ line, message: `unknown instruction '${op}'` });
      continue;
    }
    const ops = splitArgs(argStr).map((a) => parseOperand(a, line));
    instructions.push({ op, ops, line, raw: text });
  }

  // Finalize: resolve label operands that are really data symbols / equ values
  for (const ins of instructions) {
    for (let i = 0; i < ins.ops.length; i++) {
      const o = ins.ops[i];
      if (o.k !== "label" || !o.name) continue;
      if (JUMP_OPS.has(ins.op)) {
        if (!labels.has(o.name)) errors.push({ line: ins.line, message: `unknown label '${o.name}'` });
        continue;
      }
      const sym = symbols.get(o.name);
      if (sym !== undefined) ins.ops[i] = { k: "imm", v: sym };
      else if (!labels.has(o.name)) errors.push({ line: ins.line, message: `unknown symbol '${o.name}'` });
    }
  }

  return {
    instructions,
    labels,
    symbols,
    data: Uint8Array.from(dataBytes),
    dataBase: DATA_BASE,
    errors,
    lines,
  };
}

/* ──────────────────────────────── executor ──────────────────────────────── */

function makeExec(bits: 32 | 64, regDefs: Record<string, RegDef>) {
  const defBytes = (bits / 8) as OperandSize;
  const accA = bits === 64 ? "rax" : "eax";
  const accD = bits === 64 ? "rdx" : "edx";
  const cntC = bits === 64 ? "rcx" : "ecx";
  const spReg = bits === 64 ? "rsp" : "esp";

  return function exec(m: BaseMachine, ins: Instruction): void {
    const f = m.flags;
    let next = m.ip + 1;

    const effAddr = (o: Operand): number => {
      let a = o.disp ?? 0n;
      if (o.base) a += m.readReg(o.base);
      if (o.index) a += m.readReg(o.index);
      return Number(a & maskOf(bits));
    };
    const opBytes = (o: Operand | undefined): OperandSize | undefined => {
      if (!o) return undefined;
      if (o.k === "reg") return ((regDefs[o.name!].bits / 8) as OperandSize);
      if (o.size) return o.size;
      return undefined;
    };
    const inferSize = (...ops: (Operand | undefined)[]): OperandSize => {
      for (const o of ops) {
        const b = opBytes(o);
        if (b) return b;
      }
      return defBytes;
    };
    const get = (o: Operand, size: OperandSize): bigint => {
      if (o.k === "reg") return m.readReg(o.name!);
      if (o.k === "imm") return o.v! & maskOf(size * 8);
      if (o.k === "mem") return m.readMem(effAddr(o), o.size ?? size);
      if (o.k === "label") return BigInt(addrOfIndex(m.prog.labels.get(o.name!) ?? 0));
      throw new AsmRuntimeError(`invalid operand for '${ins.op}'`);
    };
    const set = (o: Operand, v: bigint, size: OperandSize): void => {
      if (o.k === "reg") m.writeReg(o.name!, v);
      else if (o.k === "mem") m.writeMem(effAddr(o), o.size ?? size, v);
      else throw new AsmRuntimeError(`destination of '${ins.op}' must be a register or memory`);
    };
    const setZS = (r: bigint, w: number) => {
      f.ZF = r === 0n;
      f.SF = (r & signBit(w)) !== 0n;
    };
    const jumpTo = (o: Operand): number => {
      const idx = m.prog.labels.get(o.name ?? "");
      if (idx === undefined) throw new AsmRuntimeError(`unknown label '${o.name}'`);
      return idx;
    };
    const push = (v: bigint, size: OperandSize) => {
      const sp = Number(m.readReg(spReg)) - size;
      m.writeReg(spReg, BigInt(sp));
      m.writeMem(sp, size, v);
    };
    const pop = (size: OperandSize): bigint => {
      const sp = Number(m.readReg(spReg));
      const v = m.readMem(sp, size);
      m.writeReg(spReg, BigInt(sp + size));
      return v;
    };

    const [d, s] = ins.ops;

    switch (ins.op) {
      case "nop": break;
      case "hlt": m.halt(null, "hlt — processor halted"); return;

      case "mov": {
        const size = inferSize(d, s);
        set(d, get(s, size), size);
        break;
      }
      case "lea": {
        if (s.k !== "mem") throw new AsmRuntimeError("lea needs a memory operand, e.g. lea eax, [msg]");
        set(d, BigInt(effAddr(s)), defBytes);
        break;
      }
      case "xchg": {
        const size = inferSize(d, s);
        const a = get(d, size);
        const b = get(s, size);
        set(d, b, size);
        set(s, a, size);
        break;
      }
      case "movzx": {
        const srcSize = opBytes(s);
        if (!srcSize) throw new AsmRuntimeError("movzx needs a sized source (register or 'byte ptr …')");
        set(d, get(s, srcSize), inferSize(d));
        break;
      }
      case "movsx": {
        const srcSize = opBytes(s);
        if (!srcSize) throw new AsmRuntimeError("movsx needs a sized source");
        const dstSize = inferSize(d);
        set(d, toSigned(get(s, srcSize), srcSize * 8) & maskOf(dstSize * 8), dstSize);
        break;
      }

      case "add": case "sub": case "cmp": {
        const size = inferSize(d, s);
        const w = size * 8;
        const a = get(d, size);
        const b = get(s, size);
        const sb = signBit(w);
        if (ins.op === "add") {
          const raw = a + b;
          const r = raw & maskOf(w);
          f.CF = raw > maskOf(w);
          f.OF = (~(a ^ b) & (a ^ r) & sb) !== 0n;
          setZS(r, w);
          set(d, r, size);
        } else {
          const r = (a - b) & maskOf(w);
          f.CF = a < b;
          f.OF = ((a ^ b) & (a ^ r) & sb) !== 0n;
          setZS(r, w);
          if (ins.op === "sub") set(d, r, size);
        }
        break;
      }
      case "inc": case "dec": {
        const size = inferSize(d);
        const w = size * 8;
        const a = get(d, size);
        const b = 1n;
        const r = (ins.op === "inc" ? a + b : a - b) & maskOf(w);
        const sb = signBit(w);
        f.OF = ins.op === "inc" ? (~(a ^ b) & (a ^ r) & sb) !== 0n : ((a ^ b) & (a ^ r) & sb) !== 0n;
        setZS(r, w); // CF untouched, like real x86
        set(d, r, size);
        break;
      }
      case "neg": {
        const size = inferSize(d);
        const w = size * 8;
        const a = get(d, size);
        const r = (0n - a) & maskOf(w);
        f.CF = a !== 0n;
        f.OF = a === signBit(w);
        setZS(r, w);
        set(d, r, size);
        break;
      }
      case "and": case "or": case "xor": case "test": {
        const size = inferSize(d, s);
        const w = size * 8;
        const a = get(d, size);
        const b = get(s, size);
        const r = ins.op === "or" ? a | b : ins.op === "xor" ? a ^ b : a & b;
        f.CF = false;
        f.OF = false;
        setZS(r & maskOf(w), w);
        if (ins.op !== "test") set(d, r & maskOf(w), size);
        break;
      }
      case "not": {
        const size = inferSize(d);
        set(d, ~get(d, size) & maskOf(size * 8), size);
        break;
      }
      case "shl": case "sal": case "shr": case "sar": {
        const size = inferSize(d);
        const w = size * 8;
        let cnt = Number(s ? get(s, 1) : 1n) & 0x3f;
        cnt %= 64;
        let a = get(d, size);
        if (cnt > 0) {
          if (ins.op === "shr") {
            f.CF = ((a >> BigInt(cnt - 1)) & 1n) !== 0n;
            a >>= BigInt(cnt);
          } else if (ins.op === "sar") {
            const sa = toSigned(a, w);
            f.CF = ((sa >> BigInt(cnt - 1)) & 1n) !== 0n;
            a = (sa >> BigInt(cnt)) & maskOf(w);
          } else {
            f.CF = ((a << BigInt(cnt)) & (maskOf(w) + 1n)) !== 0n;
            a = (a << BigInt(cnt)) & maskOf(w);
          }
          setZS(a, w);
          set(d, a, size);
        }
        break;
      }

      case "mul": {
        const size = inferSize(d);
        const w = size * 8;
        const r = m.readReg(size === 1 ? "al" : accA.slice(0, size === 2 ? 2 : undefined) || accA) * get(d, size);
        // simplified: always use full accumulator pair semantics at default width
        const full = m.readReg(accA) * get(d, size);
        const lo = full & maskOf(bits);
        const hi = (full >> BigInt(bits)) & maskOf(bits);
        m.writeReg(accA, lo);
        m.writeReg(accD, hi);
        f.CF = f.OF = hi !== 0n;
        void r; void w;
        break;
      }
      case "imul": {
        if (ins.ops.length >= 2) {
          const size = inferSize(d, s);
          const w = size * 8;
          const third = ins.ops[2];
          const a = toSigned(get(third ? s : d, size), w);
          const b = toSigned(get(third ? third : s, size), w);
          const r = (a * b) & maskOf(w);
          f.CF = f.OF = toSigned(r, w) !== a * b;
          set(d, r, size);
        } else {
          const a = toSigned(m.readReg(accA), bits);
          const b = toSigned(get(d, defBytes), bits);
          const full = a * b;
          m.writeReg(accA, full & maskOf(bits));
          m.writeReg(accD, (full >> BigInt(bits)) & maskOf(bits));
          f.CF = f.OF = toSigned(full & maskOf(bits), bits) !== full;
        }
        break;
      }
      case "div": case "idiv": {
        const divisor = ins.op === "div" ? get(d, defBytes) : toSigned(get(d, defBytes), bits);
        if (divisor === 0n) throw new AsmRuntimeError("division by zero");
        let dividend: bigint;
        if (ins.op === "div") {
          dividend = (m.readReg(accD) << BigInt(bits)) | m.readReg(accA);
        } else {
          const hi = m.readReg(accD);
          const lo = m.readReg(accA);
          dividend = toSigned((hi << BigInt(bits)) | lo, bits * 2);
        }
        let q = dividend / divisor;
        const r = dividend % divisor;
        if (ins.op === "idiv" && q < 0n && r !== 0n) q = q; // trunc toward zero: BigInt / already truncates
        if (q > maskOf(bits) || q < -(signBit(bits))) throw new AsmRuntimeError("divide overflow (quotient does not fit)");
        m.writeReg(accA, q & maskOf(bits));
        m.writeReg(accD, r & maskOf(bits));
        break;
      }
      case "cdq": case "cqo": {
        const a = m.readReg(accA);
        m.writeReg(accD, (a & signBit(bits)) !== 0n ? maskOf(bits) : 0n);
        break;
      }

      case "push": push(get(d, defBytes), defBytes); break;
      case "pop": set(d, pop(defBytes), defBytes); break;

      case "call": {
        push(BigInt(addrOfIndex(next)), defBytes);
        next = jumpTo(d);
        break;
      }
      case "ret": {
        const addr = Number(pop(defBytes));
        const idx = indexOfAddr(addr);
        if (idx === null || idx > m.prog.instructions.length) {
          throw new AsmRuntimeError(`ret to invalid address 0x${addr.toString(16)} — did you pop the return address?`);
        }
        next = idx;
        break;
      }
      case "jmp": next = jumpTo(d); break;
      case "loop": {
        const c = (m.readReg(cntC) - 1n) & maskOf(bits);
        m.writeReg(cntC, c);
        if (c !== 0n) next = jumpTo(d);
        break;
      }

      case "int": {
        const vec = Number(get(d, 1));
        if (bits === 64) throw new AsmRuntimeError("use 'syscall' in 64-bit mode (int 80h is 32-bit Linux)");
        if (vec === 0x21) {
          const ah = Number(m.readReg("ah"));
          if (ah === 0x09) {
            const addr = Number(m.readReg("edx") & 0xffffn);
            m.output += m.readString(addr, 0x24 /* $ */, 2048);
          } else if (ah === 0x02) {
            m.output += String.fromCharCode(Number(m.readReg("dl")));
          } else if (ah === 0x4c) {
            m.halt(Number(m.readReg("al")), "DOS exit (int 21h / AH=4Ch)");
            return;
          } else {
            throw new AsmRuntimeError(`int 21h function AH=${ah.toString(16)}h is not supported (try AH=9, AH=2 or AH=4Ch)`);
          }
        } else if (vec === 0x80) {
          const n = Number(m.readReg("eax"));
          if (n === 4) {
            m.output += m.readString(Number(m.readReg("ecx")), null, Number(m.readReg("edx")));
            m.writeReg("eax", m.readReg("edx"));
          } else if (n === 1) {
            m.halt(Number(m.readReg("ebx")), "Linux exit (int 80h / eax=1)");
            return;
          } else {
            throw new AsmRuntimeError(`int 80h syscall ${n} not supported (4 = write, 1 = exit)`);
          }
        } else {
          throw new AsmRuntimeError(`interrupt ${vec.toString(16)}h not supported`);
        }
        break;
      }
      case "syscall": {
        if (bits === 32) throw new AsmRuntimeError("'syscall' is 64-bit; use 'int 80h' in 32-bit mode");
        const n = Number(m.readReg("rax"));
        if (n === 1) {
          m.output += m.readString(Number(m.readReg("rsi")), null, Number(m.readReg("rdx")));
          m.writeReg("rax", m.readReg("rdx"));
        } else if (n === 60) {
          m.halt(Number(m.readReg("rdi")), "Linux exit (syscall 60)");
          return;
        } else {
          throw new AsmRuntimeError(`syscall ${n} not supported (1 = write, 60 = exit)`);
        }
        break;
      }

      default: {
        const cond = JCC[ins.op];
        if (cond) {
          if (cond(f)) next = jumpTo(d);
          break;
        }
        throw new AsmRuntimeError(`unhandled instruction '${ins.op}'`);
      }
    }
    m.ip = next;
  };
}

/* ────────────────────────────── examples ────────────────────────────── */

const EX32_HELLO = `; ── Turbo Assembler style: DOS int 21h ──────────────
; AH=9 prints the '$'-terminated string at DS:DX.
.model small
.stack 100h
.data
msg     db 'Hello from x86-32 (TASM style)!', 13, 10, '$'
.code
start:
    mov ax, @data       ; set up the data segment (emulated)
    mov ds, ax
    mov dx, offset msg  ; DX -> message
    mov ah, 9           ; DOS function 9: print string
    int 21h
    mov ax, 4C00h       ; AH=4Ch: exit, AL=00 return code
    int 21h
end start
`;

const EX32_SUM = `; ── Sum 1..10, convert to decimal, print via Linux int 80h ──
section .data
buf     db '          ', 10      ; 10 spaces + newline
buflen  equ 11
section .text
_start:
    xor eax, eax        ; sum = 0
    mov ecx, 10         ; counter
sumloop:
    add eax, ecx
    loop sumloop        ; eax = 55

    ; convert eax to ASCII digits, right to left
    mov edi, offset buf
    add edi, 9
    mov ebx, 10
convert:
    xor edx, edx
    div ebx             ; eax = eax/10, edx = remainder
    add dl, '0'
    mov [edi], dl       ; store one digit
    dec edi
    test eax, eax
    jnz convert

    mov eax, 4          ; write(1, buf, 11)
    mov ebx, 1
    mov ecx, offset buf
    mov edx, buflen
    int 80h
    mov eax, 1          ; exit(0)
    xor ebx, ebx
    int 80h
`;

const EX32_STACK = `; ── The stack: call / ret / push / pop ──────────────
; Watch ESP move and return addresses appear in memory.
_start:
    mov eax, 1
    call double         ; eax = 2
    call double         ; eax = 4
    call double         ; eax = 8
    push eax            ; park it on the stack
    pop ebx             ; take it back into ebx
    mov eax, 1          ; exit(ebx) -> exit code 8
    int 80h

double:
    add eax, eax
    ret
`;

const EX64_HELLO = `; ── x86-64 Linux: write + exit via syscall ──────────
section .data
msg     db "Hello from x86-64!", 10
len     equ $ - msg
section .text
_start:
    mov rax, 1          ; syscall 1 = write
    mov rdi, 1          ; fd 1 = stdout
    mov rsi, offset msg
    mov rdx, len
    syscall
    mov rax, 60         ; syscall 60 = exit
    xor rdi, rdi
    syscall
`;

const EX64_FIB = `; ── Fibonacci into memory ───────────────────────────
; Watch the data segment fill up, 8 bytes at a time.
section .data
fib     dq 10 dup(?)
section .text
_start:
    mov rax, 0          ; a
    mov rbx, 1          ; b
    mov rcx, 10         ; count
    mov rdi, offset fib
next:
    mov [rdi], rax      ; store a
    add rdi, 8
    mov rdx, rax        ; t = a
    mov rax, rbx        ; a = b
    add rbx, rdx        ; b = b + t
    loop next
    mov rax, 60
    xor rdi, rdi
    syscall
`;

const EX64_CALL = `; ── Calling convention warm-up ──────────────────────
; Registers r8..r15 exist only in 64-bit mode.
_start:
    mov rdi, 5
    call square         ; rax = 25
    mov r8, rax
    mov rdi, 6
    call square         ; rax = 36
    add rax, r8         ; 61
    mov rdi, rax
    mov rax, 60         ; exit(61)
    syscall

square:
    mov rax, rdi
    imul rax, rdi
    ret
`;

/* ────────────────────────────── plugin factory ────────────────────────────── */

export function createX86Plugin(bits: 32 | 64): AsmPlugin {
  const { fullRegs, regDefs } = buildRegs(bits);
  const exec = makeExec(bits, regDefs);
  const spReg = bits === 64 ? "rsp" : "esp";

  const regBits: Record<string, number> = {};
  for (const [name, d] of Object.entries(regDefs)) regBits[name] = d.bits;

  const plugin: AsmPlugin = {
    id: bits === 64 ? "x86-64" : "x86-32",
    name: bits === 64 ? "x86-64" : "x86 (32-bit)",
    subtitle: bits === 64 ? "AMD64 · Linux syscall ABI" : "IA-32 · TASM / DOS & Linux int 80h",
    origin: "core",
    bits,
    sp: spReg,
    registerGroups:
      bits === 64
        ? [
            { title: "General", regs: ["rax", "rbx", "rcx", "rdx"] },
            { title: "Index / pointers", regs: ["rsi", "rdi", "rbp", "rsp"] },
            { title: "Extended (64-bit only)", regs: ["r8", "r9", "r10", "r11", "r12", "r13", "r14", "r15"] },
          ]
        : [
            { title: "General", regs: ["eax", "ebx", "ecx", "edx"] },
            { title: "Index / pointers", regs: ["esi", "edi", "ebp", "esp"] },
            { title: "Segments", regs: ["ds", "es"] },
          ],
    regBits,
    flagNames: ["ZF", "SF", "CF", "OF"],
    syntaxNote:
      bits === 64
        ? "Intel syntax: `op dest, src`. Exit with syscall 60, print with syscall 1. `offset label` or `lea` loads an address; `[label]` reads memory."
        : "Intel/TASM syntax: `op dest, src`. DOS style: int 21h (AH=9 print $, AH=2 char, AH=4Ch exit). Linux style: int 80h (eax=4 write, eax=1 exit).",
    examples:
      bits === 64
        ? [
            { name: "Hello syscall", code: EX64_HELLO },
            { name: "Fibonacci in memory", code: EX64_FIB },
            { name: "Call & registers r8-r15", code: EX64_CALL },
          ]
        : [
            { name: "Hello DOS (TASM)", code: EX32_HELLO },
            { name: "Sum + print decimal", code: EX32_SUM },
            { name: "Stack: call/push/pop", code: EX32_STACK },
          ],
    reference: [
      { syntax: "mov dst, src", desc: "Copy. src: reg, imm, [mem], offset label" },
      { syntax: "add/sub/and/or/xor dst, src", desc: "Arithmetic & logic; set ZF SF CF OF" },
      { syntax: "inc/dec/neg/not dst", desc: "Unary ops (inc/dec keep CF)" },
      { syntax: "cmp a, b / test a, b", desc: "Flags only: compare (sub) / bit-test (and)" },
      { syntax: "jmp/je/jne/jg/jl/ja/jb… label", desc: "Jumps; signed (jg/jl) vs unsigned (ja/jb)" },
      { syntax: "loop label", desc: `dec ${bits === 64 ? "rcx" : "ecx"}, jump while non-zero` },
      { syntax: "shl/shr/sar dst, n|cl", desc: "Shifts; sar keeps the sign bit" },
      { syntax: "mul src / imul dst, src", desc: `Multiply via ${bits === 64 ? "rdx:rax" : "edx:eax"} / two-operand signed` },
      { syntax: "div src", desc: `${bits === 64 ? "rdx:rax" : "edx:eax"} ÷ src → quotient + remainder (zero ${bits === 64 ? "rdx" : "edx"} first!)` },
      { syntax: "push/pop, call/ret", desc: `Stack ops; ${spReg} moves by ${bits / 8}` },
      { syntax: "lea dst, [mem]", desc: "Load the address itself, not the value" },
      bits === 64
        ? { syntax: "syscall", desc: "rax=1 write(rdi,rsi,rdx) · rax=60 exit(rdi)" }
        : { syntax: "int 21h / int 80h", desc: "DOS: AH=9 print,$ AH=2 char, AH=4Ch exit · Linux: eax=4 write, eax=1 exit" },
      { syntax: "msg db 'hi', 13, 10, '$'", desc: "Data: db/dw/dd/dq, N dup(x), name equ $ - msg" },
    ],
    assemble: (src) => assembleX86(src, bits, regDefs),
    createMachine(prog) {
      return new BaseMachine(plugin, prog, {
        fullRegs,
        regDefs,
        spReg,
        flagNames: ["ZF", "SF", "CF", "OF"],
        zeroExtend32: bits === 64,
        exec,
      });
    },
  };
  return plugin;
}
