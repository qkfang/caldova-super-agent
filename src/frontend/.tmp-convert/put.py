"""Copy `source` over `target`, writing CRLF line endings (working-tree style)."""
import pathlib
import sys

target, source = sys.argv[1], sys.argv[2]
text = pathlib.Path(source).read_text(encoding="utf-8")
pathlib.Path(target).write_text(text, encoding="utf-8", newline="\r\n")
print(f"wrote {target} ({len(text)} chars)")
