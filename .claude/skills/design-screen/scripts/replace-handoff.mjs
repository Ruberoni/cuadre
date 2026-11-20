// design-screen, Phase 7: replace an issue's Design handoff, keeping the rest of the body byte
// for byte (line endings included: bodies edited in the web UI use CRLF).
//
//   node .claude/skills/design-screen/scripts/replace-handoff.mjs <issue> <section.md> [options]
//
// <section.md> starts with `### Design handoff` (the whole section, from that heading to the end
// of the body) or, with --block <k>, with `#### Handoff <k>: <screen>` (that block only, up to
// the next `#### Handoff` heading or the end; a block that does not exist yet is appended).
// Options:
//   --block <k>     replace or append handoff block k instead of the whole section
//   --from <file>   read the current body from a file instead of GitHub (dry runs, tests)
//   --out <file>    write the new body there and do not edit the issue (--dry-run)
// Without --out it runs `gh issue edit --body-file`, reads the issue back and fails unless the
// body is exactly what was sent and everything before the replaced part is unchanged.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const option = (flag) => {
  const i = args.indexOf(flag);
  if (i === -1) return undefined;
  const [value] = args.splice(i, 2).slice(1);
  if (value === undefined) usage();
  return value;
};
function usage() {
  console.error(
    "usage: replace-handoff.mjs <issue> <section.md> [--block <k>] [--from <file>] [--out <file>]",
  );
  process.exit(2);
}
const block = option("--block");
const from = option("--from");
const out = option("--out");
const [issue, sectionPath] = args;
if (!issue || !sectionPath) usage();

const fail = (message) => {
  console.error(`replace-handoff: ${message}`);
  process.exit(1);
};

function gh(...ghArgs) {
  const run = spawnSync("gh", ghArgs, { encoding: "utf8" });
  if (run.status !== 0) fail(`gh ${ghArgs.join(" ")} failed: ${run.stderr.trim()}`);
  return run.stdout;
}
const fetchBody = () => JSON.parse(gh("api", `repos/{owner}/{repo}/issues/${issue}`)).body ?? "";

const body = from ? readFileSync(from, "utf8") : fetchBody();
const eol = body.includes("\r\n") ? "\r\n" : "\n";
const section = `${readFileSync(sectionPath, "utf8")
  .replace(/\r\n/g, "\n")
  .replace(/\n+$/, "")
  .replace(/\n/g, eol)}${eol}`;

let start;
let end = body.length;
let separator = ""; // a blank line before the next block, when the replaced one is not last
if (block === undefined) {
  if (!section.startsWith("### Design handoff"))
    fail("the section must start with `### Design handoff`");
  start = body.indexOf("### Design handoff");
  if (start === -1) fail("the issue body has no `### Design handoff` heading");
} else {
  if (!new RegExp(`^#### Handoff ${block}: `).test(section)) {
    fail(`the block must start with \`#### Handoff ${block}: <screen>\``);
  }
  if (body.indexOf("### Design handoff") === -1)
    fail("the issue body has no `### Design handoff` heading");
  const heading = new RegExp(`(^|\\n)#### Handoff ${block}: `);
  const found = heading.exec(body);
  if (found) {
    start = found.index + found[1].length;
    const next = body.slice(start + 1).search(/\n#### Handoff \d+: /);
    if (next !== -1) {
      end = start + 1 + next + 1;
      separator = eol;
    }
  } else {
    // Append after the last block, separated by one blank line.
    const trimmed = body.replace(/(\r?\n)+$/, "");
    finish(`${trimmed}${eol}${eol}${section}`, trimmed.length);
  }
}
finish(body.slice(0, start) + section + separator + body.slice(end), start);

function finish(newBody, keptPrefixLength) {
  if (out) {
    writeFileSync(out, newBody);
    console.log(`wrote ${out} (issue not edited)`);
    process.exit(0);
  }
  const file = join(mkdtempSync(join(tmpdir(), "handoff-")), "body.md");
  writeFileSync(file, newBody);
  gh("issue", "edit", issue, "--body-file", file);
  const after = fetchBody();
  if (after.slice(0, keptPrefixLength) !== body.slice(0, keptPrefixLength)) {
    fail("the issue changed above the replaced part; check it by hand");
  }
  if (after.replace(/\s+$/, "") !== newBody.replace(/\s+$/, "")) {
    fail("the issue body read back differs from the one sent; check it by hand");
  }
  console.log(`issue #${issue}: handoff replaced, rest of the body unchanged`);
  process.exit(0);
}
