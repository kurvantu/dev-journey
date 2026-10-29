/**
 * Plugin registry. Core architectures register here at module load;
 * external plugins call `registerAsmPlugin` from `src/lib/asm/plugins/`.
 */
import { createX86Plugin } from "./x86";
import type { AsmPlugin } from "./types";

const registry = new Map<string, AsmPlugin>();

export function registerAsmPlugin(plugin: AsmPlugin): void {
  if (!registry.has(plugin.id)) registry.set(plugin.id, plugin);
}

export function listAsmPlugins(): AsmPlugin[] {
  return [...registry.values()];
}

export function getAsmPlugin(id: string): AsmPlugin | undefined {
  return registry.get(id);
}

/* core architectures */
registerAsmPlugin(createX86Plugin(32));
registerAsmPlugin(createX86Plugin(64));
