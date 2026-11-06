# Maintaining released casks

Studio maintainers publish only approved, stable public app releases here. End users use Homebrew and do not run these maintenance commands.

The Curfew cask, release updater, unit tests, and native artifact tests come from the Curfew repository. The import hashes in `docs/upstream.json` identify the exact source bytes. Do not change a version or checksum by hand.

Run the **Update Curfew release** workflow after the app release has passed its own acceptance. The updater verifies public release metadata and the downloaded canonical DMG before exporting a reviewed patch artifact. The Studio organization prohibits Actions from creating pull requests. No personal token is stored in CI. The workflow therefore exports the verified patch; the maintainer command below completes the ordinary pull request using the operator's native `gh` login. A repeated update with the same artifact does not create a commit or rewrite the cask.

```sh
node scripts/update-homebrew-cask.mjs --latest --apply
node scripts/propose-update.mjs
```

Run these commands in a checkout of this tap with your verified Studio Git identity. The proposal command preserves an existing update branch, refuses conflicting release contents, and reuses an open pull request. It prints the review URL. CI validates the actual pull request head before rebase integration.

The normal pull request checks validate the downloaded release, signature, notarization, and both Homebrew-managed commands in disposable directories. They never launch Curfew or operate on the installed app. Review and rebase-merge the resulting pull request. The app release process remains in Curfew.

To inspect locally, run `node scripts/update-homebrew-cask.mjs --latest`. Add `--apply` to prepare a change. Keep the existing command artifacts and successful unregister requirement. Revert the cask commit through a reviewed pull request if packaging regresses; do not rewrite an app release.

For local artifact acceptance, run `node scripts/validate-release.mjs`. An existing verified read-only DMG mount can be reused with explicit DMG and mount paths; the command verifies their native image association before reading the mounted app. It copies the app before Homebrew tests and detaches only mounts it created.

Run **Homebrew acceptance** on tap `main` after integration to test the public install on a clean GitHub-hosted Mac. The job starts outside the checkout, installs the public cask by its fully qualified name, and runs both commands through PATH. It repeats the install and verifies that Homebrew preserves the command links.

To repeat the signed Curfew 0.0.14 to 0.0.16 upgrade check, dispatch the Curfew evidence branch while its predecessor artifact remains available.

```sh
gh workflow run ci.yml --repo TheHypertextStudio/curfew --ref codex/homebrew-acceptance -f capture_scope=homebrew
```

For a later release, adapt the [verified Curfew-side job](https://github.com/TheHypertextStudio/curfew/blob/3fa4b889a04f9b637cdfcd50d253be49d15f4c40/.github/workflows/ci.yml#L18-L45). Check out the public tap at the exact target cask commit and set `TAP_REF` to that commit. Run `scripts/homebrew-acceptance.mjs` from the runner's temporary directory. Give the Curfew job `actions: read` and `contents: read` and pass its token as `GH_TOKEN` so it can read its own retained artifact. Identify the predecessor with `PRIOR_VERSION`, `PRIOR_RUN_ID`, `PRIOR_SOURCE_SHA`, `PRIOR_ARTIFACT_ID`, and `PRIOR_ARCHIVE_SHA256`. The job checks provenance and checksums, installs the predecessor through its historical cask, then upgrades with the proposed cask. It reports the versions, runner architecture, and tap commit. An expired artifact needs a different retained signed predecessor.
