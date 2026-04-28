/**
 * `eas run` — v0.3 verb for executing the next ready task. Thin re-export of
 * the v0.2 `implementCommand` so we don't fork the implementation. The old
 * `eas implement` remains available as a hidden deprecated alias.
 */
export { implementCommand as runCommand } from "./implement.js";
