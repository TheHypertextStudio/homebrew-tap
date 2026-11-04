#!/usr/bin/env python3
"""Format the authored bootstrap shell scaffold with an injected shell formatter."""

import re
import subprocess
import sys

PLACEHOLDER = b"@PINS@"
SENTINEL = b"__HYPERTEXT_FORMATTER_TEMPLATE_PINS__"


def main():
    source = sys.stdin.buffer.read()
    if source.count(PLACEHOLDER) != 1 or SENTINEL in source:
        raise ValueError("expected exactly one unambiguous @PINS@ scaffold placeholder")
    scaffold = source.replace(PLACEHOLDER, SENTINEL + b") : ;;")
    result = subprocess.run(sys.argv[1:], input=scaffold, capture_output=True)
    if result.returncode:
        sys.stderr.buffer.write(result.stderr)
        return result.returncode
    pattern = rb"(?m)^[ \t]*" + SENTINEL + rb"\)\s*:\s*;;[ \t]*$"
    output, count = re.subn(pattern, PLACEHOLDER, result.stdout)
    if count != 1 or SENTINEL in output:
        raise ValueError(
            "formatter did not preserve the protected case-arm placeholder"
        )
    sys.stdout.buffer.write(output)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError) as error:
        print(f"format: {error}", file=sys.stderr)
        sys.exit(1)
