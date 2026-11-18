// design-screen, Phase 3 (and Phase 6): check that a Design System file only grew.
//
//   node .claude/skills/design-screen/scripts/additive-check.mjs <old> <new>
//
// <old> is the file as read from the artifact, <new> the one about to be published. The rule
// depends on the file name:
//   - tokens.json: every entry of the old file is still there and identical; arrays of named
//     entries (`name`/`id`) are matched by name, other arrays must keep the old items first.
//   - reviews.md: only a new entry on top; the intro (up to the first `## `) and every old
//     entry stay byte for byte.
//   - anything else (bundle.css, bundle.js): the old text is an unchanged prefix of the new one.
// Exit 0 when additive; exit 1 with the first difference found.
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { isDeepStrictEqual } from "node:util";

const [oldPath, newPath] = process.argv.slice(2);
if (!oldPath || !newPath) {
  console.error("usage: additive-check.mjs <old> <new>");
  process.exit(2);
}

const oldText = readFileSync(oldPath, "utf8");
const newText = readFileSync(newPath, "utf8");
const name = basename(newPath);

const fail = (message) => {
  console.error(`NOT ADDITIVE (${name}): ${message}`);
  process.exit(1);
};

const keyOf = (item) =>
  item && typeof item === "object" && !Array.isArray(item) ? (item.name ?? item.id) : undefined;

// Every part of `before` survives unchanged in `after`.
function contained(before, after, path) {
  if (Array.isArray(before)) {
    if (!Array.isArray(after)) fail(`${path} is no longer an array`);
    if (before.length > 0 && before.every((item) => keyOf(item) !== undefined)) {
      for (const item of before) {
        const match = after.find((other) => keyOf(other) === keyOf(item));
        if (!match) fail(`${path}: entry "${keyOf(item)}" was removed`);
        if (!isDeepStrictEqual(item, match)) fail(`${path}: entry "${keyOf(item)}" changed`);
      }
      return;
    }
    before.forEach((item, i) => {
      if (!isDeepStrictEqual(item, after[i])) fail(`${path}[${i}] changed or moved`);
    });
    return;
  }
  if (before && typeof before === "object") {
    if (!after || typeof after !== "object" || Array.isArray(after)) {
      fail(`${path} is no longer an object`);
    }
    for (const key of Object.keys(before)) {
      if (!(key in after)) fail(`${path}.${key} was removed`);
      contained(before[key], after[key], `${path}.${key}`);
    }
    return;
  }
  if (before !== after)
    fail(`${path} changed from ${JSON.stringify(before)} to ${JSON.stringify(after)}`);
}

if (name === "tokens.json") {
  contained(JSON.parse(oldText), JSON.parse(newText), "tokens");
} else if (name === "reviews.md") {
  const firstEntry = oldText.indexOf("\n## ");
  if (firstEntry === -1) fail("the old file has no `## ` entry to anchor on");
  const intro = oldText.slice(0, firstEntry + 1);
  const entries = oldText.slice(firstEntry + 1);
  if (!newText.startsWith(intro)) fail("the intro above the first entry changed");
  if (!newText.endsWith(entries)) fail("an existing entry changed (new entries go on top)");
  if (newText.length < oldText.length) fail("the file got shorter");
} else if (!newText.startsWith(oldText)) {
  let i = 0;
  while (i < oldText.length && oldText[i] === newText[i]) i++;
  const line = oldText.slice(0, i).split("\n").length;
  fail(`old text changed at line ${line}; new rules go after it`);
}

console.log(`additive (${name})`);
