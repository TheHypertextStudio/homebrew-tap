# Homebrew tap maintenance

This repository packages released Studio apps. Do not build or release apps here.

Use commit scopes `casks` for released app installation and `release-updates` for verified update tooling. Use scoped Conventional Commits and include Codex coauthor attribution. Use the existing Studio identity for commits. Keep origin on SSH. Integrate through ordinary pull requests with rebase merging.

Run `node --test scripts/*.test.mjs`, `brew style Casks/curfew.rb`, and the native disposable packaging tests before integration. Never install, uninstall, quit, or unregister the user's live Curfew app during validation. Never write to the user's Homebrew prefix.

The cask, updater, and native artifact tests are vendored from Curfew. Preserve their upstream behavior. Updates must verify the canonical public release DMG against its published SHA-256. Repeated update runs must leave unchanged files untouched.

Prepare commit formatting with `SSL_CERT_FILE=/etc/ssl/cert.pem python3 .hypertext/formatter-tools/setup.py` and `python3 .hypertext/formatting/install.py`.
