#!/usr/bin/env python3
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BOOTSTRAP = ROOT / ".bootstrap" / "v2"
manifest = json.loads((BOOTSTRAP / "manifest.json").read_text(encoding="utf-8"))

for key, target in manifest.items():
    source_dir = BOOTSTRAP / "parts" / key
    chunks = sorted(source_dir.glob("*.part"))
    if not chunks:
        raise RuntimeError(f"Missing source chunks for {target}")
    content = "".join(chunk.read_text(encoding="utf-8") for chunk in chunks)
    target_path = ROOT / target
    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_text(content, encoding="utf-8")
    print(f"assembled {target} from {len(chunks)} chunk(s)")

legacy = ROOT / "site" / "data" / "knowledge.json"
if legacy.exists():
    legacy.unlink()
    print("removed legacy site/data/knowledge.json")

shutil.rmtree(ROOT / ".bootstrap")
print("bootstrap source removed")
