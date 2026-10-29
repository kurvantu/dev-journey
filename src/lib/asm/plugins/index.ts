/**
 * Plugin loader. Importing this module (for side effects) registers every
 * external architecture. To add a new ISA: create a file in this folder that
 * builds an `AsmPlugin` and register it below — the playground UI picks it
 * up automatically, no core changes required.
 */
import { registerAsmPlugin } from "../registry";
import { armPlugin } from "./arm";

registerAsmPlugin(armPlugin);
