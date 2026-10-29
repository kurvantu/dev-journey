"use client";

import CodeMirror from "@uiw/react-codemirror";
import { oneDark } from "@codemirror/theme-one-dark";
import { cpp } from "@codemirror/lang-cpp";
import { rust } from "@codemirror/lang-rust";
import { go } from "@codemirror/lang-go";
import { php } from "@codemirror/lang-php";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { EditorView } from "@codemirror/view";
import { useMemo } from "react";

const LANG_EXT = {
  c: () => cpp(),
  rust: () => rust(),
  go: () => go(),
  php: () => php(),
  node: () => javascript(),
  python: () => python(),
} as const;

export type EditorLang = keyof typeof LANG_EXT;

const baseTheme = EditorView.theme({
  "&": { fontSize: "13.5px", height: "100%" },
  ".cm-scroller": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", lineHeight: "1.6" },
  ".cm-content": { padding: "12px 0" },
  ".cm-gutters": { backgroundColor: "#0f172a", borderRight: "1px solid #1e293b" },
  "&.cm-editor": { backgroundColor: "#0b1120" },
});

export default function CodeEditor({
  lang,
  value,
  onChange,
  height = "420px",
  readOnly = false,
}: {
  lang: EditorLang;
  value: string;
  onChange?: (v: string) => void;
  height?: string;
  readOnly?: boolean;
}) {
  const extensions = useMemo(() => [LANG_EXT[lang](), baseTheme], [lang]);
  return (
    <CodeMirror
      value={value}
      height={height}
      theme={oneDark}
      extensions={extensions}
      onChange={onChange}
      readOnly={readOnly}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: true,
        autocompletion: true,
        bracketMatching: true,
        indentOnInput: true,
      }}
    />
  );
}
