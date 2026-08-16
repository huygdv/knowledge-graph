from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any


HEADING_RE = re.compile(r"^##\s+(.+?)\s*$", re.MULTILINE)
FRAGMENT_RE = re.compile(r"^Fragment\s+(\d+)\s*(?:[—–-]\s*)?(.*)$", re.IGNORECASE)


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "fragment"


def sha256_text(value: str) -> str:
    return "sha256:" + hashlib.sha256(value.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class NormalizedFragment:
    id: str
    type: str
    title: str
    locator: str
    content_hash: str
    content: str
    ordinal: int

    def as_dict(self, include_content: bool = True) -> dict[str, Any]:
        result: dict[str, Any] = {
            "id": self.id,
            "type": self.type,
            "title": self.title,
            "locator": self.locator,
            "contentHash": self.content_hash,
            "ordinal": self.ordinal,
        }
        if include_content:
            result["content"] = self.content
        return result

    def contract_source(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type,
            "title": self.title,
            "locator": self.locator,
            "contentHash": self.content_hash,
        }


class SourceAdapter:
    adapter_id = "base"

    def normalize(self, text: str, *, source_name: str) -> list[NormalizedFragment]:
        raise NotImplementedError


class MarkdownSourceAdapter(SourceAdapter):
    """Split Markdown into stable H2-level fragments.

    Benchmark-style headings such as `## Fragment 3 — Safety` receive stable IDs
    `source.fragment-3`; other H2 headings use a deterministic slug.
    """

    adapter_id = "markdown"

    def normalize(self, text: str, *, source_name: str = "input.md") -> list[NormalizedFragment]:
        matches = list(HEADING_RE.finditer(text))
        fragments: list[NormalizedFragment] = []

        if not matches:
            content = text.strip()
            if not content:
                return []
            fragments.append(
                NormalizedFragment(
                    id="source.document",
                    type=self.adapter_id,
                    title=Path(source_name).stem or "Document",
                    locator=source_name,
                    content_hash=sha256_text(content),
                    content=content,
                    ordinal=1,
                )
            )
            return fragments

        seen_ids: set[str] = set()
        for ordinal, match in enumerate(matches, start=1):
            heading = match.group(1).strip()
            body_start = match.end()
            body_end = matches[ordinal].start() if ordinal < len(matches) else len(text)
            body = text[body_start:body_end].strip()

            fragment_match = FRAGMENT_RE.match(heading)
            if fragment_match:
                number = fragment_match.group(1)
                title = fragment_match.group(2).strip() or f"Fragment {number}"
                slug = f"fragment-{number}"
            else:
                title = heading
                slug = slugify(heading)

            base_id = f"source.{slug}"
            source_id = base_id
            suffix = 2
            while source_id in seen_ids:
                source_id = f"{base_id}-{suffix}"
                suffix += 1
            seen_ids.add(source_id)

            fragments.append(
                NormalizedFragment(
                    id=source_id,
                    type=self.adapter_id,
                    title=title,
                    locator=f"{source_name}#{slug}",
                    content_hash=sha256_text(body),
                    content=body,
                    ordinal=ordinal,
                )
            )

        return fragments


def normalize_markdown_file(path: Path) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8")
    adapter = MarkdownSourceAdapter()
    fragments = adapter.normalize(text, source_name=path.name)
    return {
        "adapter": adapter.adapter_id,
        "sourceName": path.name,
        "sourceHash": sha256_text(text),
        "fragments": [fragment.as_dict(include_content=True) for fragment in fragments],
    }
