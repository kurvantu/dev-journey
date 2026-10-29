"use client";

import { useState } from "react";
import Runner, { TRACK_META } from "./Runner";
import type { EditorLang } from "./CodeEditor";
import type { Snippet } from "@/db/schema";

const LANGS: EditorLang[] = ["c", "rust", "go", "php", "python", "node"];

export const TEMPLATES: Record<EditorLang, string> = {
  c: `#include <stdio.h>

int main(void) {
    char name[64];
    printf("What is your name? ");
    if (scanf("%63s", name) == 1) {
        printf("\\nHello, %s! Welcome to C.\\n", name);
    } else {
        printf("\\nHello, stranger! (type a name in stdin)\\n");
    }
    return 0;
}
`,
  rust: `use std::io::{self, Read};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let name = input.trim();
    if name.is_empty() {
        println!("Hello, stranger! (type a name in stdin)");
    } else {
        println!("Hello, {}! Welcome to Rust.", name);
    }
}
`,
  go: `package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

func main() {
	reader := bufio.NewReader(os.Stdin)
	line, _ := reader.ReadString('\\n')
	name := strings.TrimSpace(line)
	if name == "" {
		fmt.Println("Hello, stranger! (type a name in stdin)")
		return
	}
	fmt.Printf("Hello, %s! Welcome to Go.\\n", name)
}
`,
  php: `<?php
$name = trim((string) fgets(STDIN));
$name = $name === "" ? "stranger" : htmlspecialchars($name);
?>
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; padding: 32px; background: #0f172a; color: #e2e8f0">
  <h1 style="color: #a78bfa">Hello, <?= $name ?>!</h1>
  <p>PHP printed this HTML – open the <b>Screen</b> tab to see it rendered.</p>
  <p>Generated at <?= date("H:i:s") ?> with PHP <?= PHP_VERSION ?>.</p>
</body>
</html>
`,
  python: `# A tiny neural network that learns XOR - no libraries, 30 lines.
import math, random
random.seed(7)

data = [([0, 0], 0), ([0, 1], 1), ([1, 0], 1), ([1, 1], 0)]
H = 4
W1 = [[random.uniform(-1, 1) for _ in range(H)] for _ in range(2)]
b1 = [0.0] * H
W2 = [random.uniform(-1, 1) for _ in range(H)]
b2 = 0.0
sig = lambda z: 1 / (1 + math.exp(-z))

for epoch in range(4001):
    loss = 0.0
    for x, y in data:
        h = [math.tanh(sum(x[i] * W1[i][j] for i in range(2)) + b1[j]) for j in range(H)]
        p = sig(sum(h[j] * W2[j] for j in range(H)) + b2)
        loss += -(y * math.log(p + 1e-9) + (1 - y) * math.log(1 - p + 1e-9))
        d = p - y                                   # dLoss/dLogit
        for j in range(H):
            dh = d * W2[j] * (1 - h[j] ** 2)
            W2[j] -= 0.1 * d * h[j]
            b1[j] -= 0.1 * dh
            for i in range(2):
                W1[i][j] -= 0.1 * dh * x[i]
        b2 -= 0.1 * d
    if epoch % 1000 == 0:
        print(f"epoch {epoch:5d}  loss {loss / 4:.4f}")

print()
for x, y in data:
    h = [math.tanh(sum(x[i] * W1[i][j] for i in range(2)) + b1[j]) for j in range(H)]
    p = sig(sum(h[j] * W2[j] for j in range(H)) + b2)
    print(f"{x} -> {p:.3f}  (target {y})")
`,
  node: `const readline = require("readline");

const rl = readline.createInterface({ input: process.stdin });
let name = "";
rl.on("line", (line) => { if (!name) name = line.trim(); });
rl.on("close", () => {
  console.log(\`Hello, \${name || "stranger"}! Welcome to Node.js.\`);
  console.log("Node version:", process.version);
});
`,
};

export default function Playground({ initialSnippets }: { initialSnippets: Snippet[] }) {
  const [lang, setLang] = useState<EditorLang>("node");
  const [code, setCode] = useState<string>(TEMPLATES.node);
  const [stdin, setStdin] = useState("Ada");
  const [snippets, setSnippets] = useState<Snippet[]>(initialSnippets);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [editorKey, setEditorKey] = useState(0);

  const switchLang = (l: EditorLang) => {
    setLang(l);
    setCode(TEMPLATES[l]);
    setEditorKey((k) => k + 1);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/snippets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, trackId: lang, code, stdin }),
      });
      if (res.ok) {
        const row = (await res.json()) as Snippet;
        setSnippets((s) => [row, ...s]);
        setTitle("");
      }
    } finally {
      setSaving(false);
    }
  };

  const load = (s: Snippet) => {
    setLang(s.trackId as EditorLang);
    setCode(s.code);
    setStdin(s.stdin ?? "");
    setEditorKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (id: number) => {
    await fetch(`/api/snippets?id=${id}`, { method: "DELETE" });
    setSnippets((s) => s.filter((x) => x.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* language tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {LANGS.map((l) => {
          const m = TRACK_META[l];
          const active = l === lang;
          return (
            <button
              key={l}
              onClick={() => switchLang(l)}
              className={`rounded-xl border px-4 py-2 font-mono text-sm font-semibold transition ${active ? "text-slate-950" : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500"}`}
              style={active ? { background: m.color, borderColor: m.color } : undefined}
            >
              {m.name}
            </button>
          );
        })}
        <span className="ml-auto text-xs text-slate-500">Switching language loads a fresh template.</span>
      </div>

      <Runner
        key={editorKey}
        lang={lang}
        initialCode={code}
        code={code}
        onCodeChange={setCode}
        stdin={stdin}
        onStdinChange={setStdin}
        initialStdin={stdin}
        editorHeight="460px"
        toolbar={
          <div className="flex items-center gap-1.5">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Snippet title"
              className="hidden w-32 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-slate-500 sm:block"
            />
            <button onClick={save} disabled={saving} className="rounded-lg bg-slate-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-600 disabled:opacity-50">
              {saving ? "Saving…" : "💾 Save"}
            </button>
          </div>
        }
      />

      {/* saved snippets */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Saved snippets ({snippets.length})</h2>
        {snippets.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-800 p-6 text-center text-sm text-slate-500">
            Nothing saved yet. Write something, give it a title and hit 💾 Save – it is stored in PostgreSQL.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {snippets.map((s) => {
              const m = TRACK_META[s.trackId as EditorLang] ?? TRACK_META.node;
              return (
                <li key={s.id} className="group rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-white">{s.title}</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        <span className="font-mono" style={{ color: m.color }}>
                          {m.name}
                        </span>{" "}
                        · {new Date(s.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <button onClick={() => remove(s.id)} className="text-xs text-slate-600 hover:text-rose-400" title="Delete">
                      ✕
                    </button>
                  </div>
                  <pre className="mt-3 max-h-24 overflow-hidden whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-slate-400">{s.code.slice(0, 240)}</pre>
                  <button onClick={() => load(s)} className="mt-3 w-full rounded-lg bg-slate-800 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700">
                    Load into editor
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
