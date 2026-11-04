# Native formatters

`native.py` formats stdin to stdout with pinned native tools. Run the setup commands
listed in `native-rules.json` once during repository setup; formatting never installs
or downloads tools. Missing tools stop the commit with a setup instruction.

SwiftFormat reuses `.swiftformat` when present. Curfew keeps its verified 0.64.1
wrapper and cache; other Swift repositories pin 0.64.1 with archive and executable
SHA-256 verification. The reviewed SwiftFormat archives require macOS.

Rust uses the exact rustup toolchain 1.99.1 and each manifest's edition. It formats
the staged source without resolving module files from the working tree and does not
change Cargo target directories. Meson 1.12.1 uses a dedicated cached Python
environment. Blueprint 0.22.2 uses its upstream pure Python formatter from a
checksum-verified source archive; it needs no GTK installation or running VM.

`python3 .hypertext/formatter-tools/test_native.py` verifies the native adapters.

`shell-template.py FORMATTER [ARGS...]` protects the authored launcher's `@PINS@`
case-arm placeholder while the ordinary shell formatter parses its scaffold. It
restores the exact placeholder only after checking the formatter retained its
sentinel. Pass the same prepared, pinned shell formatter used for `.sh` files.

Native style files remain authoritative. Curfew’s command wrapper reads its
SwiftFormat artifact pin from `native.py`; Rust repositories select the same
toolchain in `rust-toolchain.toml` and the staged-byte adapter.

The native toolchain reader requires Python 3.11 or newer. The shared formatting
engine retains its own Python requirement.
