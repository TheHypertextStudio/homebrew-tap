import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmod,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
const script = resolve("scripts/propose-update.mjs");
const source = '  version "0.0.16"\n';
async function scenario(mode) {
  const root = await mkdtemp(join(tmpdir(), "tap-proposal-"));
  try {
    await mkdir(join(root, "Casks"));
    await mkdir(join(root, "bin"));
    await writeFile(join(root, "Casks/curfew.rb"), source);
    execFileSync("git", ["init", "--quiet", root]);
    execFileSync("git", [
      "-C",
      root,
      "config",
      "user.name",
      "Fixture Maintainer",
    ]);
    execFileSync("git", [
      "-C",
      root,
      "config",
      "user.email",
      "fixture@hypertext.studio",
    ]);
    const fake = join(root, "bin/gh");
    await writeFile(
      fake,
      `#!${process.execPath}
const fs = require('node:fs');
const a = process.argv.slice(2); const input = fs.readFileSync(0,'utf8');
fs.appendFileSync(process.env.CALLS,JSON.stringify({a,input})+'\\n');
const m = process.env.MODE; const s = ${JSON.stringify(source)};
let r = {};
if (a[0] === 'pr') { console.log('https://github.com/TheHypertextStudio/homebrew-tap/pull/1'); process.exit(0); }
const p = a[1];
if (p.includes('git/trees/')) r={tree:[{path:'Casks/curfew.rb'}]};
else if (p.includes('contents/')) r={sha:'old-sha',content:Buffer.from(m==='noop'||(m==='resume'&&p.includes('release-update'))?s:m==='conflict'&&p.includes('release-update')?'other release':'old cask').toString('base64')};
else if(p.includes('matching-refs')) r=m==='create'?[]:[{ref:'refs/heads/release-update/curfew'}];
else if(p.includes('git/ref/')) r={object:{sha:'main-sha'}};
else if(p.includes('pulls?')) r=m==='resume'?[{number:1}]:[];
console.log(JSON.stringify(r));
`,
    );
    await chmod(fake, 0o755);
    const result = spawnSync(process.execPath, [script], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: join(root, "bin") + ":" + process.env.PATH,
        MODE: mode,
        CALLS: join(root, "calls"),
      },
    });
    const calls = (await readFile(join(root, "calls"), "utf8"))
      .trim()
      .split("\n")
      .map(JSON.parse);
    return { result, calls };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
test("the published release is a read-only no-op", async () => {
  const { result, calls } = await scenario("noop");
  assert.equal(result.status, 0, result.stderr);
  assert.ok(calls.every(({ a }) => a[0] === "api" && !a.includes("--method")));
});
test("an operator creates one update branch and ordinary pull request", async () => {
  const { result, calls } = await scenario("create");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(calls.filter(({ a }) => a.includes("PUT")).length, 1);
  assert.equal(
    calls.filter(({ a }) => a[0] === "pr" && a[1] === "create").length,
    1,
  );
  const body = JSON.parse(calls.find(({ a }) => a.includes("PUT")).input);
  assert.equal(body.author.email, "fixture@hypertext.studio");
  assert.equal(body.sha, "old-sha");
});
test("a repeat proposal reuses the branch and open pull request", async () => {
  const { result, calls } = await scenario("resume");
  assert.equal(result.status, 0, result.stderr);
  assert.ok(
    !calls.some(
      ({ a }) => a.includes("--method") || (a[0] === "pr" && a[1] === "create"),
    ),
  );
});
test("a conflicting maintainer branch is preserved", async () => {
  const { result, calls } = await scenario("conflict");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /another release/);
  assert.ok(
    !calls.some(
      ({ a }) => a.includes("--method") || (a[0] === "pr" && a[1] === "create"),
    ),
  );
});
