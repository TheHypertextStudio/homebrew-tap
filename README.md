# Hypertext Studio Homebrew tap

Install Curfew and its bundled beta commands with Homebrew:

```sh
brew install --cask thehypertextstudio/tap/curfew
```

Homebrew manages the app, `curfew-ctl`, and `curfew-mcp`. Curfew requires macOS 26. The command line tools remain in beta. See the [cask](Casks/curfew.rb) for the version Homebrew installs and the [CLI guide](https://thecurfew.app/docs/cli) for commands and examples.

Run `brew upgrade --cask thehypertextstudio/tap/curfew` to upgrade. Run `brew uninstall --cask curfew` to remove it. Uninstall first requires Curfew to unregister its background service successfully. Ordinary uninstall preserves application data. `brew uninstall --cask --zap curfew` explicitly removes the listed application data.

Maintainers update the cask through the verified release workflow described in [maintenance](docs/maintenance.md).
