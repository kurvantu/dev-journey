import type { Metadata } from "next";
import type { ReactNode } from "react";
import Nav from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "PolyglotLab – learn C, Rust, Go, PHP & Node.js by running code",
  description:
    "An interactive playground and strategic mindmap for learning multiple programming languages and frameworks through universal concepts.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.12),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(56,189,248,0.10),transparent_55%)]" />
        <Nav />
        {children}
        <footer className="mx-auto max-w-7xl px-6 py-10 text-center text-xs text-slate-600">
          PolyglotLab · Concepts over syntax · Code runs locally when a toolchain exists, otherwise in the Piston sandbox.
        </footer>
      </body>
    </html>
  );
}
