import Link from "next/link";
import dynamic from "next/dynamic";

const AsmPlayground = dynamic(() => import("@/components/asm/AsmPlayground"), {
  loading: () => <div className="grid h-96 place-items-center text-slate-500">Powering up the virtual CPU…</div>,
});

export const metadata = {
  title: "Assembly Dojo – x86-32, x86-64 & ARM playground | PolyglotLab",
  description:
    "A Turbo Assembler style playground: write x86 or ARM assembly, run it on a visual CPU emulator and watch registers, flags, stack and memory change at your own speed.",
};

export default function AssemblyPage() {
  return (
    <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Assembly Dojo</p>
          <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
            Talk to the CPU <span className="bg-gradient-to-r from-cyan-300 to-emerald-400 bg-clip-text text-transparent">directly</span>
          </h1>
          <p className="mt-3 text-slate-400">
            A Turbo-Assembler-style playground running on a visual CPU emulator. Write <strong className="text-slate-200">x86 (32-bit)</strong>,{" "}
            <strong className="text-slate-200">x86-64</strong> or <strong className="text-slate-200">ARM</strong> assembly, pick an execution speed, and
            watch every register, flag, stack slot and memory byte change as each instruction retires. Slow the clock down until you can
            narrate what the machine is doing — that is the whole point.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/learn/c/memory" className="rounded-xl border border-slate-700 px-4 py-2 text-slate-200 hover:border-slate-500">
            C memory lesson →
          </Link>
          <Link href="/mindmap" className="rounded-xl border border-slate-700 px-4 py-2 text-slate-200 hover:border-slate-500">
            Mindmap
          </Link>
        </div>
      </div>

      <AsmPlayground />

      {/* ───────────── learning content ───────────── */}
      <section className="mt-12">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Learn the machine</p>
        <h2 className="mt-2 text-2xl font-bold text-white">Four ideas and you can read any assembly</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card
            icon="🗄️"
            title="Registers are the CPU's hands"
            body="A handful of named slots (eax, rdi, r0…) that arithmetic happens in. Everything else — variables, objects, arrays — must be loaded into a register before the CPU can touch it. Watch the register panel: that is ALL the state the processor has."
          />
          <Card
            icon="🚩"
            title="Flags remember the last result"
            body="cmp subtracts and throws away the answer, keeping only the flags: Zero, Sign/Negative, Carry, Overflow. Every if, while and for in every language compiles down to 'do arithmetic, then jump on a flag'. Run the Sum example at Slow speed and watch ZF flip."
          />
          <Card
            icon="📚"
            title="The stack is just memory + a pointer"
            body="push writes at the stack pointer and moves it down; call pushes a return address; ret pops it into the instruction pointer. Run the call examples and watch return addresses appear — now you know what a stack overflow actually overflows."
          />
          <Card
            icon="📞"
            title="Syscalls are the only door out"
            body="A program that wants to print or exit must ask the OS: load magic numbers into registers and trigger int 80h / syscall / svc. Every print() in every language ends in one of these three instructions. Compare the hello example across all three architectures."
          />
        </div>
      </section>

      <section className="mt-10 grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <h3 className="font-semibold text-white">⚙️ One ISA, three dialects — learn sideways</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Load the hello example in x86-32, then x86-64, then ARM. The <em>concepts</em> are identical — registers, a write syscall, an exit
            syscall — only the register names and calling conventions change. This is the Rosetta method applied one level below C.
          </p>
        </article>
        <article className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <h3 className="font-semibold text-white">🧩 Architectures are plugins</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            The playground core knows nothing about any instruction set. x86-32 and x86-64 register themselves as core plugins; ARM ships as an
            external plugin in <code className="rounded bg-slate-800 px-1 font-mono text-xs text-cyan-300">src/lib/asm/plugins/arm.ts</code> and the
            dropdown picks it up automatically. Adding RISC-V would mean one new file implementing <code className="rounded bg-slate-800 px-1 font-mono text-xs text-cyan-300">AsmPlugin</code> — assemble, execute, describe — and one{" "}
            <code className="rounded bg-slate-800 px-1 font-mono text-xs text-cyan-300">registerAsmPlugin()</code> call.
          </p>
        </article>
        <article className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <h3 className="font-semibold text-white">🐢 Why the speed dial matters</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            At <strong className="text-slate-200">Slow</strong> you can say out loud what each instruction will do before it happens — active recall.
            <strong className="text-slate-200"> Medium</strong> is for watching loops breathe. <strong className="text-slate-200">High</strong> shows
            the shape of an algorithm. <strong className="text-slate-200">Max</strong> runs batched, like a real CPU — use it to check results, not to
            learn. Drop back to Slow whenever something surprises you.
          </p>
        </article>
      </section>

      <section className="mt-10 rounded-2xl border border-cyan-800/40 bg-[#071033]/50 p-6">
        <h3 className="font-semibold text-white">Suggested path through the dojo</h3>
        <ol className="mt-3 grid gap-2 text-sm text-slate-300 md:grid-cols-2">
          <li className="rounded-lg bg-slate-900/60 px-3 py-2"><b className="text-cyan-300">1.</b> Run <em>Hello DOS (TASM)</em> at Speed: Slow. Narrate every line.</li>
          <li className="rounded-lg bg-slate-900/60 px-3 py-2"><b className="text-cyan-300">2.</b> <em>Sum + print decimal</em> — watch ZF drive the loop, then the div/remainder dance.</li>
          <li className="rounded-lg bg-slate-900/60 px-3 py-2"><b className="text-cyan-300">3.</b> <em>Stack: call/push/pop</em> — keep your eyes on ESP and the stack panel only.</li>
          <li className="rounded-lg bg-slate-900/60 px-3 py-2"><b className="text-cyan-300">4.</b> Switch to x86-64, run <em>Fibonacci in memory</em> — watch the data segment fill.</li>
          <li className="rounded-lg bg-slate-900/60 px-3 py-2"><b className="text-cyan-300">5.</b> Switch to the ARM plugin and port the sum program yourself from x86.</li>
          <li className="rounded-lg bg-slate-900/60 px-3 py-2"><b className="text-cyan-300">6.</b> Write FizzBuzz from scratch in any ISA. If you can, you have genuinely learned assembly.</li>
        </ol>
        <p className="mt-4 text-xs text-slate-500">
          Then go up one level: the <Link href="/learn/c" className="text-cyan-300 hover:underline">C track</Link> shows what a compiler generates from
          these exact primitives, and the <Link href="/llm-lab" className="text-cyan-300 hover:underline">LLM Lab</Link> shows what a few billion of
          these instructions per second can pretend to be.
        </p>
      </section>
    </main>
  );
}

function Card({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
      <div className="text-2xl">{icon}</div>
      <h3 className="mt-2 font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{body}</p>
    </article>
  );
}
