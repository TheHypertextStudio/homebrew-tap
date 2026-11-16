# Development

This repository holds the Homebrew cask for Curfew and the scripts that check it. Contributors change the cask or its tooling and check the result locally; they do not build Curfew here.

## Quickstart

The checks need macOS, [Homebrew](https://brew.sh), and Node.js 24 or later. They run without any sign-in or token.

```sh
git clone https://github.com/TheHypertextStudio/homebrew-tap
cd homebrew-tap
node --test scripts/*.test.mjs
brew style Casks/curfew.rb
brew ruby Tests/Packaging/cask_cli_test.rb
```

`node --test` runs the updater and cask unit tests. `brew style` applies Homebrew's style rules to the cask. The last command loads the cask with Homebrew's own loader and links both bundled commands, `curfew-ctl` and `curfew-mcp`, into a temporary directory. It never touches your Homebrew prefix or an installed Curfew.

Pull requests run the same commands, and also check the cask against the downloaded public release. Maintainers update the cask version and checksum as described in [maintenance](maintenance.md); do not edit them by hand.
