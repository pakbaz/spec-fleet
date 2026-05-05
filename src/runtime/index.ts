/**
 * `runtime/index.ts` — re-export the v0.6 runtime surface. The legacy
 * `SpecFleetRuntime` class (which wrapped the GitHub Copilot SDK) has been
 * replaced by `Workspace` + a free-standing `dispatch()` helper. See
 * `docs/migration-from-0.5.md` for the upgrade story.
 */
export { Workspace, DEFAULT_CONFIG, ensureWorkspaceConfig } from "./workspace.js";
export type { WorkspaceConfig, WorkspaceOpenOptions } from "./workspace.js";
export { dispatch, buildArgv, probeCopilot } from "./dispatch.js";
export type { DispatchOptions, DispatchResult } from "./dispatch.js";
export { loadCharter, loadAllCharters, mirrorCharters, toCopilotAgentMd } from "./charter.js";
export {
  readScratchpad,
  appendScratchpad,
  searchScratchpad,
  archiveScratchpad,
  SCRATCHPAD_SECTIONS,
  isScratchpadSection,
} from "./scratchpad.js";
export type {
  ScratchpadSection,
  ScratchpadAppendEntry,
  ScratchpadSearchHit,
} from "./scratchpad.js";
