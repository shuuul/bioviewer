// Prints a version's CHANGELOG.md section as release notes grouped by entry type.
// Usage: node .github/scripts/release-notes.mjs <version>
import { readFileSync } from "node:fs";

const GROUPS = {
  feat: "Features",
  fix: "Bug Fixes",
  perf: "Performance",
  docs: "Documentation",
  refactor: "Refactoring",
  test: "Tests",
  ci: "CI",
  chore: "Maintenance",
};

const version = process.argv[2];
if (!version) {
  throw new Error("usage: release-notes.mjs <version>");
}

const lines = readFileSync(new URL("../../CHANGELOG.md", import.meta.url), "utf8").split("\n");
const start = lines.findIndex((line) => line.startsWith(`## [${version}]`));
if (start === -1) {
  throw new Error(`CHANGELOG.md has no section for ${version}`);
}
const next = lines.findIndex((line, index) => index > start && line.startsWith("## "));
const section = lines.slice(start + 1, next === -1 ? undefined : next).filter((line) => line.trim());

const breaking = [];
const grouped = new Map(Object.keys(GROUPS).map((type) => [type, []]));
for (const line of section) {
  const match = /^- (\w+)(?:\([^)]*\))?(!)?: (.+)$/.exec(line);
  if (!match || !grouped.has(match[1])) {
    throw new Error(`CHANGELOG.md ${version} entry has no known type prefix: ${line}`);
  }
  const [, type, bang, text] = match;
  const entry = `- ${text[0].toUpperCase()}${text.slice(1)}`;
  (bang ? breaking : grouped.get(type)).push(entry);
}

const blocks = [];
if (breaking.length) {
  blocks.push(["### ⚠ Breaking Changes", ...breaking].join("\n"));
}
for (const [type, entries] of grouped) {
  if (entries.length) {
    blocks.push([`### ${GROUPS[type]}`, ...entries].join("\n"));
  }
}
console.log(blocks.join("\n\n"));
