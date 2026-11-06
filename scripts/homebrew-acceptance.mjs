import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  openSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
  appendFileSync,
} from "node:fs";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

const env = process.env;
const tap = "thehypertextstudio/tap";
const token = `${tap}/curfew`;
const sourceRepo = "TheHypertextStudio/curfew";
const team = "T95VDD3A4W";
const app = "/Applications/Curfew.app";
const cask = "Casks/curfew.rb";
const tools = ["curfew-ctl", "curfew-mcp"];

function requireMatch(condition, message) {
  if (!condition) throw new Error(message);
}

function capture(program, args, input) {
  return execFileSync(program, args, {
    encoding: "utf8",
    input,
    stdio: ["pipe", "pipe", "inherit"],
  }).trim();
}

function run(program, ...args) {
  execFileSync(program, args, { stdio: "inherit" });
}

function commandPath(tool) {
  for (const dir of env.PATH.split(":")) {
    const candidate = join(dir, tool);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

function verifyTeam(path) {
  const details = capture("/bin/sh", [
    "-c",
    'codesign -dv --verbose=4 "$1" 2>&1',
    "codesign",
    path,
  ]);
  requireMatch(
    details.split("\n").includes(`TeamIdentifier=${team}`),
    `Unexpected signing team for ${path}.`,
  );
}

function verifyInstall(version) {
  requireMatch(
    capture("brew", ["list", "--cask", "--versions", token]) ===
      `curfew ${version}`,
    `Homebrew did not record Curfew ${version}.`,
  );
  requireMatch(
    capture("/usr/libexec/PlistBuddy", [
      "-c",
      "Print :CFBundleShortVersionString",
      join(app, "Contents/Info.plist"),
    ]) === version,
    `The installed app bundle is not Curfew ${version}.`,
  );
  run("codesign", "--verify", "--deep", "--strict", "--verbose=2", app);
  verifyTeam(app);
  run("xcrun", "stapler", "validate", app);
  for (const tool of tools) {
    const link = commandPath(tool);
    const expected = join(app, "Contents/Resources", tool);
    requireMatch(
      link &&
        lstatSync(link).isSymbolicLink() &&
        realpathSync(link) === expected,
      `${tool} does not resolve through its Homebrew link.`,
    );
    verifyTeam(expected);
    console.log(`${tool} resolves through PATH at ${link}`);
  }

  requireMatch(
    capture("curfew-ctl", ["--help"]).includes("curfew-ctl"),
    "curfew-ctl did not print its help.",
  );
  const initialize = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {},
  });
  const response = JSON.parse(capture("curfew-mcp", [], `${initialize}\n`));
  requireMatch(
    response.jsonrpc === "2.0" &&
      response.id === 1 &&
      response.result?.serverInfo?.name === "curfew-mcp",
    "curfew-mcp did not respond to initialize.",
  );
  console.log(`Verified signed Curfew ${version}.`);
}

function linkState() {
  return tools
    .map((tool) => {
      const path = commandPath(tool);
      const { ino, mtimeNs } = lstatSync(path, { bigint: true });
      return `${path}:${ino}:${mtimeNs}:${realpathSync(path)}`;
    })
    .join("\n");
}

function verifyRepeat(command) {
  const before = linkState();
  run("brew", command, "--cask", token);
  requireMatch(
    linkState() === before,
    `Repeating brew ${command} changed the command links.`,
  );
}

function extract(program, args, path) {
  const fd = openSync(path, "wx");
  try {
    execFileSync(program, args, { stdio: ["ignore", fd, "inherit"] });
  } finally {
    closeSync(fd);
  }
}

function verifySHA(path, digest) {
  const actual = createHash("sha256").update(readFileSync(path)).digest("hex");
  requireMatch(actual === digest, `SHA-256 mismatch for ${basename(path)}.`);
}

function sourceAPI(path) {
  return JSON.parse(capture("gh", ["api", `repos/${sourceRepo}/${path}`]));
}

function preparePriorCask(fixture, targetVersion) {
  const {
    PRIOR_VERSION: version,
    PRIOR_RUN_ID: runID,
    PRIOR_SOURCE_SHA: commit,
    PRIOR_ARTIFACT_ID: artifactID,
    PRIOR_ARCHIVE_SHA256: digest,
  } = env;
  requireMatch(
    env.GITHUB_REPOSITORY === sourceRepo,
    "Call upgrade acceptance from the Curfew repository.",
  );
  requireMatch(
    /^\d+\.\d+\.\d+$/.test(version) &&
      version.localeCompare(targetVersion, "en", { numeric: true }) < 0,
    "Provide the version of an earlier Curfew release.",
  );
  requireMatch(
    /^\d+$/.test(runID) && /^\d+$/.test(artifactID),
    "Provide exact numeric run and artifact IDs.",
  );
  requireMatch(
    /^[a-f0-9]{40}$/.test(commit) && /^[a-f0-9]{64}$/.test(digest),
    "Provide exact prior source and artifact digests.",
  );

  const release = sourceAPI(`actions/runs/${runID}`);
  requireMatch(
    release.conclusion === "success" &&
      release.event === "push" &&
      release.head_sha === commit &&
      release.head_branch === `v${version}` &&
      release.path === ".github/workflows/release.yml",
    "The release run does not match the signed predecessor.",
  );
  const artifact = sourceAPI(`actions/artifacts/${artifactID}`);
  requireMatch(
    artifact.name === "curfew-signed-candidate" &&
      artifact.expired === false &&
      artifact.digest === `sha256:${digest}` &&
      String(artifact.workflow_run.id) === runID &&
      artifact.workflow_run.head_sha === commit,
    "The artifact does not match the retained signed candidate.",
  );

  const archive = join(fixture, "candidate.zip");
  extract(
    "gh",
    ["api", `repos/${sourceRepo}/actions/artifacts/${artifactID}/zip`],
    archive,
  );
  verifySHA(archive, digest);
  const manifest = JSON.parse(
    capture("unzip", ["-p", archive, "candidate.json"]),
  );
  requireMatch(
    manifest.schemaVersion === 1 &&
      manifest.version === version &&
      manifest.sourceCommit === commit &&
      manifest.runID === runID &&
      manifest.team === team &&
      /^[a-f0-9]{64}$/.test(manifest.dmgSHA256),
    "The signed candidate manifest does not match the predecessor.",
  );
  const dmg = join(fixture, `Curfew-v${version}.dmg`);
  extract("unzip", ["-p", archive, basename(dmg)], dmg);
  verifySHA(dmg, manifest.dmgSHA256);
  run("xcrun", "stapler", "validate", dmg);

  const historical = Buffer.from(
    sourceAPI(`contents/${cask}?ref=${commit}`).content,
    "base64",
  ).toString("utf8");
  const replacements = [
    [/^  version "[^"]+"$/gm, `  version "${version}"`],
    [/^  sha256 "[^"]+"$/gm, `  sha256 "${manifest.dmgSHA256}"`],
    [
      /^  url "https:\/\/github\.com\/TheHypertextStudio\/curfew\/releases\/download\/[^"]+"(?:,\n +verified: "[^"]+")?$/gm,
      `  url "${pathToFileURL(dmg).href}"`,
    ],
  ];
  let projected = historical;
  for (const [pattern, replacement] of replacements) {
    requireMatch(
      [...projected.matchAll(pattern)].length === 1,
      "The historical cask does not match the signed-artifact fixture format.",
    );
    projected = projected.replace(pattern, () => replacement);
  }
  const priorCask = join(fixture, "curfew.rb");
  writeFileSync(priorCask, projected);
  return priorCask;
}

function verifyUpgrade(targetVersion) {
  const fixture = mkdtempSync(join(env.RUNNER_TEMP, "curfew-homebrew."));
  try {
    const priorCask = preparePriorCask(fixture, targetVersion);
    run("brew", "tap", tap);
    const tapDir = capture("brew", ["--repository", tap]);
    run("git", "-C", tapDir, "fetch", "--depth", "1", "origin", env.TAP_REF);
    run("git", "-C", tapDir, "checkout", "--detach", env.TAP_REF);
    copyFileSync(priorCask, join(tapDir, cask));

    run("brew", "install", "--cask", token);
    verifyInstall(env.PRIOR_VERSION);
    run("git", "-C", tapDir, "restore", "--source", env.TAP_REF, "--", cask);
    run("brew", "upgrade", "--cask", token);
    verifyInstall(targetVersion);
    verifyRepeat("upgrade");
    return `Verified Homebrew upgrade from signed Curfew ${env.PRIOR_VERSION} to ${targetVersion}.`;
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

function verifyPublicInstall(targetVersion, source) {
  requireMatch(
    env.GITHUB_REPOSITORY === "TheHypertextStudio/homebrew-tap" &&
      env.GITHUB_REF === "refs/heads/main",
    "Run the public installation check from tap main.",
  );
  requireMatch(
    !capture("brew", ["tap"]).split("\n").includes(tap),
    "The public tap is already present.",
  );
  run("brew", "install", "--cask", token);
  const tapDir = capture("brew", ["--repository", tap]);
  requireMatch(
    capture("git", ["-C", tapDir, "show", `HEAD:${cask}`]) === source.trim(),
    "Homebrew installed a different public cask revision.",
  );
  verifyInstall(targetVersion);
  verifyRepeat("install");
  return `Verified public Homebrew installation of Curfew ${targetVersion}.`;
}

function main() {
  requireMatch(
    env.GITHUB_ACTIONS === "true" &&
      env.RUNNER_ENVIRONMENT === "github-hosted" &&
      env.RUNNER_OS === "macOS",
    "Run this acceptance test on a disposable GitHub-hosted macOS runner.",
  );
  const cwd = realpathSync(process.cwd());
  const workspace = realpathSync(env.GITHUB_WORKSPACE);
  requireMatch(
    cwd === realpathSync(env.RUNNER_TEMP) &&
      cwd !== workspace &&
      !cwd.startsWith(`${workspace}/`),
    "Run from outside the source checkout.",
  );
  requireMatch(
    /^[a-f0-9]{40}$/.test(env.TAP_REF),
    "The tap ref must be an exact commit SHA.",
  );
  requireMatch(
    capture("git", ["-C", workspace, "rev-parse", "HEAD"]) === env.TAP_REF,
    "The checkout differs from the expected tap commit.",
  );
  const source = readFileSync(join(workspace, cask), "utf8");
  const targetVersion = /^  version "(\d+\.\d+\.\d+)"$/m.exec(source)?.[1];
  requireMatch(targetVersion, "The target cask must pin one release version.");

  const homebrew = capture("brew", ["--version"]);
  const macOS = capture("sw_vers", ["-productVersion"]);
  const arch = capture("uname", ["-m"]);
  console.log(
    `${homebrew} on macOS ${macOS} (${arch}). Tap commit ${env.TAP_REF}.`,
  );
  requireMatch(!existsSync(app), "Curfew.app already exists.");
  for (const tool of tools)
    requireMatch(!commandPath(tool), `${tool} already exists on PATH.`);

  const result = env.PRIOR_VERSION
    ? verifyUpgrade(targetVersion)
    : verifyPublicInstall(targetVersion, source);
  console.log(result);
  appendFileSync(
    env.GITHUB_STEP_SUMMARY,
    `${result}\n\nBoth commands ran from PATH. Repeating the Homebrew command preserved both links.\n\n${homebrew} on macOS ${macOS} (${arch}). Tap commit ${env.TAP_REF}.\n`,
  );
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
