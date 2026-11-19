"""Splice helper: replace the text of `target` up to (not including) `marker`
with the contents of `head`, writing CRLF line endings."""
import pathlib
import sys

target, head, marker = sys.argv[1], sys.argv[2], sys.argv[3]
t = pathlib.Path(target).read_text(encoding="utf-8")
h = pathlib.Path(head).read_text(encoding="utf-8")
idx = t.index(marker)
pathlib.Path(target).write_text(h + t[idx:], encoding="utf-8", newline="\r\n")
print(f"spliced {target}: kept {len(t) - idx} chars after marker")
