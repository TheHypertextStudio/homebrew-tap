import subprocess
import sys
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("native.py")


class NativeFormatterTests(unittest.TestCase):
    def test_rust_formats_stdin_without_following_module_files(self):
        source = b'mod absent;\nfn main(){println!("x");}\n'
        result = subprocess.run(
            [sys.executable, str(SCRIPT), "rust", "--edition", "2024"],
            input=source,
            capture_output=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr.decode())
        self.assertEqual(
            result.stdout, b'mod absent;\nfn main() {\n    println!("x");\n}\n'
        )

    def test_invalid_source_fails_without_printing_formatted_code(self):
        result = subprocess.run(
            [sys.executable, str(SCRIPT), "rust", "--edition", "2024"],
            input=b"fn main( {",
            capture_output=True,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, b"")


if __name__ == "__main__":
    unittest.main()
