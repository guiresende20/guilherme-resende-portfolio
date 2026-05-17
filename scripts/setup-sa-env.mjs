#!/usr/bin/env node
// Reads a Google Service Account JSON file, minifies it, and writes
// the GOOGLE_DRIVE_SA_JSON line into .env (creating or replacing it).
//
// Usage:
//   node scripts/setup-sa-env.mjs <path-to-sa.json>
//
// Example:
//   node scripts/setup-sa-env.mjs C:\Users\guire\Downloads\sa.json
//
// The secret never leaves your machine. After it runs, you can delete
// the source JSON file.

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SA_PATH = process.argv[2];
if (!SA_PATH) {
  console.error("Usage: node scripts/setup-sa-env.mjs <path-to-sa.json>");
  process.exit(1);
}

const absPath = resolve(SA_PATH);
if (!existsSync(absPath)) {
  console.error(`File not found: ${absPath}`);
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(readFileSync(absPath, "utf8"));
} catch (e) {
  console.error(`Not valid JSON: ${e.message}`);
  process.exit(1);
}

const required = ["type", "project_id", "private_key", "client_email"];
const missing = required.filter((k) => !parsed[k]);
if (missing.length) {
  console.error(`Missing fields in JSON: ${missing.join(", ")}`);
  console.error("This does not look like a Service Account key file.");
  process.exit(1);
}
if (parsed.type !== "service_account") {
  console.error(`Expected type="service_account", got "${parsed.type}"`);
  process.exit(1);
}

const minified = JSON.stringify(parsed);
const envLine = `GOOGLE_DRIVE_SA_JSON='${minified}'`;

const envPath = resolve(".env");
let currentLines = [];
if (existsSync(envPath)) {
  currentLines = readFileSync(envPath, "utf8").split(/\r?\n/);
}

const keyRegex = /^GOOGLE_DRIVE_SA_JSON\s*=/;
const existingIdx = currentLines.findIndex((line) => keyRegex.test(line));
let action;
if (existingIdx >= 0) {
  currentLines[existingIdx] = envLine;
  action = "replaced";
} else {
  if (currentLines.length && currentLines[currentLines.length - 1] !== "") {
    currentLines.push("");
  }
  currentLines.push(envLine);
  action = "appended";
}

writeFileSync(envPath, currentLines.join("\n"), "utf8");

console.log(`OK: ${action} GOOGLE_DRIVE_SA_JSON in .env`);
console.log(`  - client_email: ${parsed.client_email}`);
console.log(`  - project_id:   ${parsed.project_id}`);
console.log(`  - line length:  ${envLine.length} chars`);
console.log("");
console.log("Next: delete the source JSON file (no longer needed).");
