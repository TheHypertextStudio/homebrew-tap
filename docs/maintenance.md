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

## Test a signed candidate before publication

Use the [Curfew candidate acceptance runbook](https://github.com/TheHypertextStudio/curfew/blob/286ad403b9cd507566b4f6fa1d6d70f46cdfc959/Documentation/homebrew-candidate-acceptance.md) to run a fresh install and an upgrade from the published cask on separate clean Macs. Pass the signing run ID, source commit, and DMG checksum from the candidate manifest. The job verifies both commands on PATH and repeats the Homebrew operation to check that it leaves the installation unchanged.

For example, [the 0.0.20 candidate check](https://github.com/TheHypertextStudio/curfew/actions/runs/42203730847) upgraded public 0.0.16 and tested all 22 beta help paths.
