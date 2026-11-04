# Maintaining released casks

Studio maintainers publish only approved, stable public app releases here. End users use Homebrew and do not run these maintenance commands.

The Curfew cask, release updater, unit tests, and native artifact tests come from the Curfew repository. The next packaging change records exact source hashes. Do not change a version or checksum by hand.

Run the **Update Curfew release** workflow after the app release has passed its own acceptance. The updater verifies public release metadata and the downloaded canonical DMG before preparing a cask pull request. A repeated update with the same artifact does not create a commit or rewrite the cask.

The normal pull request checks validate the downloaded release, signature, notarization, and both Homebrew-managed commands in disposable directories. They never launch Curfew or operate on the installed app. Review and rebase-merge the resulting pull request. The app release process remains in Curfew.

To inspect locally, run `node scripts/update-homebrew-cask.mjs --latest`. Add `--apply` to prepare a change. Keep the existing command artifacts and successful unregister requirement. Revert the cask commit through a reviewed pull request if packaging regresses; do not rewrite an app release.
