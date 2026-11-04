# Hypertext Studio Homebrew tap

Install Curfew and its bundled beta commands with Homebrew:

```sh
brew install --cask thehypertextstudio/tap/curfew
```

Homebrew manages the app, `curfew-ctl`, and `curfew-mcp`. No source checkout or Swift toolchain is required. Curfew requires macOS 26. The command line tools remain beta; the current cask installs the published `0.0.16` app and its existing commands. Features still under development ship in a future app release.

Run `brew upgrade --cask curfew` to upgrade. Run `brew uninstall --cask curfew` to remove it. Uninstall first requires Curfew to unregister its background service successfully. Ordinary uninstall preserves application data. `brew uninstall --cask --zap curfew` explicitly removes the listed application data.

Maintainers update the cask through the verified release workflow described in [maintenance](docs/maintenance.md).
