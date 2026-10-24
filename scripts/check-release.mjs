import { readFileSync } from "node:fs";

const version = JSON.parse(readFileSync("package.json", "utf8")).version;
const tag = process.env.GITHUB_REF_NAME;
const notes = readFileSync("RELEASE_NOTES.md", "utf8").trim();

if (!tag || tag !== `v${version}`) {
  throw new Error(`Expected tag v${version}, got ${tag ?? "none"}`);
}
if (!notes.startsWith(`# ${tag}\n`) || !notes.slice(`# ${tag}\n`.length).trim()) {
  throw new Error(`RELEASE_NOTES.md must start with "# ${tag}" and contain release text`);
}
