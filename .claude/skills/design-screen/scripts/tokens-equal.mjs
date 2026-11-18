// design-screen, Phase 8: are two tokens.json files the same tokens?
//
//   node .claude/skills/design-screen/scripts/tokens-equal.mjs <a> <b>
//
// Compares parsed JSON, never bytes: the token generator reserializes apps/web's copy.
// Exit 0 and print "equal" when deep-equal; exit 1 and print "differ" otherwise.
import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";

const [a, b] = process.argv.slice(2);
if (!a || !b) {
  console.error("usage: tokens-equal.mjs <a> <b>");
  process.exit(2);
}
const parse = (path) => JSON.parse(readFileSync(path, "utf8"));
const equal = isDeepStrictEqual(parse(a), parse(b));
console.log(equal ? "equal" : "differ");
process.exit(equal ? 0 : 1);
