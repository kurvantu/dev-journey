/**
 * Modular assembly playground – plugin architecture.
 *
 * An architecture (ISA) is a *plugin*: a self-contained object that knows how
 * to assemble source text and execute it one instruction at a time on a tiny
 * virtual machine. x86-32 and x86-64 ship as core plugins; ARM is registered
 * as an external plugin from `src/lib/asm/plugins/` to prove the point.
 */

export type OperandSize = 1 | 2 | 4 | 8;

export interface Operand {
  k: "reg" | "imm" | "mem" | "label" | "list";
  /** register name or label/symbol name */
  name?: string;
  /** immediate value */
  v?: bigint;
  /** memory operand parts */
  base?: string;
  index?: string;
  disp?: bigint;
  /** explicit size override in bytes (byte ptr …) */
  size?: OperandSize;
  /** register list for ARM push/pop */
  list?: string[];
}

export interface Instruction {
  op: string;
  ops: Operand[];
  line: number; // 1-based source line
  raw: string;
}

export interface AsmError {
  line: number;
  message: string;
}

export interface AssembledProgram {
  instructions: Instruction[];
  /** label (lowercase) -> instruction index */
  labels: Map<string, number>;
  /** data symbol / equ (lowercase) -> value (usually an address) */
  symbols: Map<string, bigint>;
  data: Uint8Array;
  dataBase: number;
  errors: AsmError[];
  lines: string[];
}

export interface RegisterGroup {
  title: string;
  regs: string[];
}

export interface AsmExample {
  name: string;
  code: string;
}

export interface RefEntry {
  syntax: string;
  desc: string;
}

export interface RegDef {
  full: string; // canonical storage register
  shift: number; // bit offset inside the canonical register
  bits: number; // width of this view
}

export interface MachineError {
  line: number;
  message: string;
}

export interface Machine {
  plugin: AsmPlugin;
  prog: AssembledProgram;
  mem: Uint8Array;
  flags: Record<string, boolean>;
  output: string;
  halted: boolean;
  haltNote: string | null;
  exitCode: number | null;
  steps: number;
  /** index of the NEXT instruction to execute */
  ip: number;
  error: MachineError | null;
  /** canonical names of registers changed by the last step */
  lastChanged: Set<string>;
  lastMem: { addr: number; len: number } | null;
  initialSp: number;
  step(): void;
  readReg(name: string): bigint;
  fullOf(name: string): string;
  spValue(): number;
}

export interface AsmPlugin {
  id: string;
  name: string;
  subtitle: string;
  origin: "core" | "plugin";
  bits: 32 | 64;
  /** display name of the stack pointer */
  sp: string;
  registerGroups: RegisterGroup[];
  regBits: Record<string, number>;
  flagNames: string[];
  syntaxNote: string;
  examples: AsmExample[];
  reference: RefEntry[];
  assemble(src: string): AssembledProgram;
  createMachine(prog: AssembledProgram): Machine;
}

/** Shared memory layout for all plugins. */
export const MEM_SIZE = 0x10000; // 64 KiB
export const DATA_BASE = 0x1000;
export const STACK_TOP = 0xff00;
/** Pseudo address of instruction 0 – makes return addresses look real. */
export const CODE_BASE = 0x8000;

export const addrOfIndex = (idx: number) => CODE_BASE + idx * 4;
export const indexOfAddr = (addr: number) => {
  const rel = addr - CODE_BASE;
  if (rel < 0 || rel % 4 !== 0) return null;
  return rel / 4;
};
