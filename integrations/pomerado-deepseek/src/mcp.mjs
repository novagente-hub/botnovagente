#!/usr/bin/env node
import { startMcpCli } from "pomerado";
import { createDeepseekProvider } from "./provider.mjs";

// Pomerado retains its Guardian, browser policies and MCP job management.
// Only the model provider is replaced; don't connect to production yet.
const provider = createDeepseekProvider();
startMcpCli(process.argv.slice(2), {
  minterProvider: provider,
  guardianProvider: provider,
  outcomeReviewerProvider: provider,
});
