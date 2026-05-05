/**
 * Public API for embedding the SpecFleet v0.6 runtime in other tools.
 *
 * v0.6 is a thin shim over GitHub Copilot CLI: every phase eventually
 * shells out to `copilot -p`. There is no in-process SDK any more.
 */
export { Workspace, DEFAULT_CONFIG, ensureWorkspaceConfig } from "./runtime/workspace.js";
export type { WorkspaceConfig, WorkspaceOpenOptions } from "./runtime/workspace.js";
export { dispatch, buildArgv, probeCopilot } from "./runtime/dispatch.js";
export type { DispatchOptions, DispatchResult } from "./runtime/dispatch.js";
export {
  loadCharter,
  loadAllCharters,
  mirrorCharters,
  toCopilotAgentMd,
} from "./runtime/charter.js";
export {
  readScratchpad,
  appendScratchpad,
  searchScratchpad,
  archiveScratchpad,
  SCRATCHPAD_SECTIONS,
  isScratchpadSection,
} from "./runtime/scratchpad.js";
export {
  CharterSchema,
  InstructionSchema,
  ProjectSchema,
  RunEventSchema,
  SpecFrontmatterSchema,
} from "./schema/index.js";
export type {
  Charter,
  Instruction,
  Project,
  RunEvent,
  SpecFrontmatter,
} from "./schema/index.js";
export {
  findSpecFleetRoot,
  specFleetPaths,
  specPaths,
} from "./util/paths.js";
export type { SpecFleetPaths, SpecPaths } from "./util/paths.js";
