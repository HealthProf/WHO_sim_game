// Public surface for the model engine, split into three focused modules:
// core.ts (delta application + escalation state), shadow.ts (the Optimal
// counterfactual simulation), and drift.ts (passive time-based drift + the
// epidemic growth model). Re-exported from here so every existing importer
// keeps working unchanged.
export * from "./core";
export * from "./shadow";
export * from "./drift";
