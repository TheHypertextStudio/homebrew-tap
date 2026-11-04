import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { updateCask } from "./update-homebrew-cask.mjs";

const run = (command, args, options = {}) =>
  execFileSync(command, args, { stdio: "inherit", ...options });
const temporary = await mkdtemp(join(tmpdir(), "curfew-tap-acceptance-"));
const mount = process.argv[3] ?? join(temporary, "mounted");
let mounted = false;
try {
  const source = await readFile("Casks/curfew.rb", "utf8");
  const version = /^  version "([0-9]+\.[0-9]+\.[0-9]+)"$/m.exec(source)?.[1];
  if (!version)
    throw new Error("The cask must select an exact released version.");
  const metadata = run(
    "gh",
    [
      "release",
      "view",
      `v${version}`,
      "--repo",
      "TheHypertextStudio/curfew",
      "--json",
      "tagName,isDraft,isPrerelease,assets",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
  const release = JSON.parse(metadata);
  let dmg = process.argv[2];
  if (!dmg) {
    run("gh", [
      "release",
      "download",
      `v${version}`,
      "--repo",
      "TheHypertextStudio/curfew",
      "--pattern",
      `Curfew-v${version}.dmg`,
      "--dir",
      temporary,
    ]);
    dmg = join(temporary, `Curfew-v${version}.dmg`);
  }
  const verified = updateCask(source, release, await readFile(dmg));
  if (verified !== source)
    throw new Error("The cask differs from the verified published release.");
  const metadataPath = join(temporary, "release.json");
  await writeFile(metadataPath, metadata);
  const before = await readFile("Casks/curfew.rb");
  for (let attempt = 0; attempt < 2; attempt++) {
    run("node", [
      "scripts/update-homebrew-cask.mjs",
      metadataPath,
      dmg,
      "--apply",
    ]);
    if (!(await readFile("Casks/curfew.rb")).equals(before))
      throw new Error("Repeat update changed the cask.");
  }
  if (process.argv[3]) {
    const info = run("hdiutil", ["info", "-plist"], {
      stdio: ["ignore", "pipe", "inherit"],
    });
    run(
      "python3",
      [
        "-c",
        `import plistlib,sys,os
p=plistlib.loads(sys.stdin.buffer.read())
assert any(os.path.realpath(i.get('image-path','')) == os.path.realpath(sys.argv[1]) and any(e.get('mount-point') == sys.argv[2] for e in i.get('system-entities',[])) for i in p.get('images',[])), 'The supplied mount does not belong to the verified DMG.'`,
        dmg,
        mount,
      ],
      { input: info, stdio: ["pipe", "inherit", "inherit"] },
    );
  } else {
    await mkdir(mount);
    run("hdiutil", [
      "attach",
      "-readonly",
      "-nobrowse",
      "-mountpoint",
      mount,
      dmg,
    ]);
    mounted = true;
  }
  const app = join(mount, "Curfew.app");
  run("codesign", ["--verify", "--deep", "--strict", app]);
  for (const artifact of [
    app,
    join(app, "Contents/Resources/curfew-ctl"),
    join(app, "Contents/Resources/curfew-mcp"),
  ]) {
    const result = spawnSync("codesign", ["-dvv", artifact], {
      encoding: "utf8",
    });
    if (
      result.status !== 0 ||
      !result.stderr.includes("TeamIdentifier=T95VDD3A4W")
    )
      throw new Error("The artifact is not signed by the Studio release team.");
  }
  run("xcrun", ["stapler", "validate", app]);
  run("brew", ["ruby", "Tests/Packaging/cask_cli_test.rb", mount], {
    env: { ...process.env, HOMEBREW_NO_AUTO_UPDATE: "1" },
  });
  console.log(
    "Verified release digest, signatures, notarization, repeat updates, and native disposable Homebrew command artifacts.",
  );
} finally {
  if (mounted) run("hdiutil", ["detach", mount]);
  await rm(temporary, { recursive: true, force: true });
}
