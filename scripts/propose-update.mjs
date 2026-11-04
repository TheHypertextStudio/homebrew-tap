import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
const repository = "TheHypertextStudio/homebrew-tap";
const gh = (args, input) =>
  execFileSync("gh", args, {
    encoding: "utf8",
    input,
    stdio: ["pipe", "pipe", "inherit"],
  });
const api = (path, body) =>
  JSON.parse(
    gh(
      [
        "api",
        `repos/${repository}/${path}`,
        ...(body ? ["--method", "POST", "--input", "-"] : []),
      ],
      body && JSON.stringify(body),
    ),
  );
const source = await readFile("Casks/curfew.rb");
const readCask = (ref) => {
  const tree = api(`git/trees/${ref}?recursive=1`);
  return tree.tree.some((entry) => entry.path === "Casks/curfew.rb")
    ? api(`contents/Casks/curfew.rb?ref=${ref}`)
    : { content: "", sha: undefined };
};
const published = readCask("main");
if (source.equals(Buffer.from(published.content, "base64"))) {
  console.log(
    "The tap already contains the verified release. No branch or pull request changed.",
  );
} else {
  const name = execFileSync("git", ["config", "user.name"], {
    encoding: "utf8",
  }).trim();
  const email = execFileSync("git", ["config", "user.email"], {
    encoding: "utf8",
  }).trim();
  if (!name || !email.endsWith("@hypertext.studio"))
    throw new Error(
      "Configure your verified Studio Git identity before proposing an update.",
    );
  const branch = "release-update/curfew";
  const refs = api("git/matching-refs/heads/release-update/curfew");
  if (!refs.some((ref) => ref.ref === `refs/heads/${branch}`)) {
    api("git/refs", {
      ref: `refs/heads/${branch}`,
      sha: api("git/ref/heads/main").object.sha,
    });
  }
  const existing = readCask(branch);
  const version = /^  version "([^"]+)"$/m.exec(source.toString())[1];
  if (!source.equals(Buffer.from(existing.content, "base64"))) {
    // Never replace another maintainer's update branch contents.
    if (
      !Buffer.from(existing.content, "base64").equals(
        Buffer.from(published.content, "base64"),
      )
    ) {
      throw new Error(
        "The existing update branch contains another release. Review it before updating again.",
      );
    }
    gh(
      [
        "api",
        `repos/${repository}/contents/Casks/curfew.rb`,
        "--method",
        "PUT",
        "--input",
        "-",
      ],
      JSON.stringify({
        message: `chore(casks): Update Curfew to ${version}\n\nVerify the canonical stable public release DMG against its published SHA-256 before updating the managed app and bundled beta commands.${process.env.HYPERTEXT_AGENT_COAUTHOR ? "\n\nCo-authored-by: " + process.env.HYPERTEXT_AGENT_COAUTHOR : ""}`,
        content: source.toString("base64"),
        sha: existing.sha,
        branch,
        author: { name, email },
        committer: { name, email },
      }),
    );
  }
  const pulls = api(`pulls?state=open&head=TheHypertextStudio:${branch}`);
  if (!pulls.length)
    gh([
      "pr",
      "create",
      "--repo",
      repository,
      "--head",
      branch,
      "--base",
      "main",
      "--title",
      `chore(casks): Update Curfew to ${version}`,
      "--body",
      `Select the verified public Curfew ${version} release. Native artifact, signature, notarization, and repeat-install checks must pass before ordinary rebase merge. The bundled commands remain beta.`,
    ]);
  // Operator gh credentials trigger the normal pull_request checks.
  console.log(
    gh([
      "pr",
      "view",
      branch,
      "--repo",
      repository,
      "--json",
      "url",
      "--jq",
      ".url",
    ]).trim(),
  );
  console.log(
    "The release update is ready for review. No app release was created or changed.",
  );
}
