#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path
from typing import Any


FRAME_HINTS = (
    "hero",
    "section",
    "card",
    "panel",
    "dashboard",
    "widget",
    "modal",
    "drawer",
    "sidebar",
    "toolbar",
    "nav",
    "timeline",
    "gallery",
    "grid",
    "table",
    "form",
    "monitor",
    "process",
    "terminal",
    "console",
    "canvas",
)

LAYOUT_HINTS = (
    "grid",
    "flex",
    "container",
    "fixed",
    "sticky",
    "absolute",
    "relative",
    "columns",
    "sidebar",
    "fullscreen",
    "full-screen",
    "h-screen",
    "min-h-screen",
    "max-w",
    "mx-auto",
    "gap-",
    "space-",
)

CONTROL_TAGS = {
    "button",
    "input",
    "select",
    "textarea",
    "form",
    "label",
    "details",
    "summary",
    "dialog",
}

TEXT_TAGS = {"title", "h1", "h2", "h3", "h4", "button", "a", "label", "th", "td"}
FRAME_TAGS = {"header", "nav", "main", "section", "article", "aside", "footer", "form"}


def clean_text(value: str) -> str:
    value = re.sub(r"\s+", " ", value).strip()
    return value[:160]


def tokenise(value: str | None) -> list[str]:
    if not value:
        return []
    return [part.strip() for part in re.split(r"\s+", value) if part.strip()]


@dataclass
class HtmlInventoryParser(HTMLParser):
    tags: Counter[str] = field(default_factory=Counter)
    classes: Counter[str] = field(default_factory=Counter)
    ids: Counter[str] = field(default_factory=Counter)
    headings: list[dict[str, str]] = field(default_factory=list)
    controls: list[dict[str, str]] = field(default_factory=list)
    links: list[dict[str, str]] = field(default_factory=list)
    dependencies: list[dict[str, str]] = field(default_factory=list)
    frames: list[dict[str, Any]] = field(default_factory=list)
    layout_tokens: Counter[str] = field(default_factory=Counter)
    counts: Counter[str] = field(default_factory=Counter)
    title: str = ""
    text_stack: list[dict[str, Any]] = field(default_factory=list)
    frame_stack: list[dict[str, Any]] = field(default_factory=list)

    def __post_init__(self) -> None:
        HTMLParser.__init__(self)

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = {key: value or "" for key, value in attrs}
        self.tags[tag] += 1
        self.counts[tag] += 1

        class_tokens = tokenise(attrs_dict.get("class"))
        for class_name in class_tokens:
            self.classes[class_name] += 1
            lowered = class_name.lower()
            for hint in LAYOUT_HINTS:
                if hint in lowered:
                    self.layout_tokens[hint] += 1

        element_id = attrs_dict.get("id", "")
        if element_id:
            self.ids[element_id] += 1

        if tag in TEXT_TAGS:
            self.text_stack.append({"tag": tag, "attrs": attrs_dict, "text": []})

        href = attrs_dict.get("href")
        src = attrs_dict.get("src")
        if tag == "a" and href is not None:
            self.links.append({"tag": tag, "href": href, "text": ""})
        if tag in {"script", "link", "img", "iframe", "source"} and (src or href):
            self.dependencies.append({"tag": tag, "src": src or href or ""})

        if tag in CONTROL_TAGS:
            self.controls.append(
                {
                    "tag": tag,
                    "id": element_id,
                    "class": attrs_dict.get("class", ""),
                    "type": attrs_dict.get("type", ""),
                    "name": attrs_dict.get("name", ""),
                    "text": "",
                }
            )

        frame_hint = self.frame_hint(tag, attrs_dict, class_tokens)
        if frame_hint:
            frame = {
                "tag": tag,
                "hint": frame_hint,
                "id": element_id,
                "class": attrs_dict.get("class", ""),
                "heading": "",
                "depth": len(self.frame_stack),
            }
            self.frames.append(frame)
            self.frame_stack.append(frame)

    def handle_endtag(self, tag: str) -> None:
        if self.text_stack and self.text_stack[-1]["tag"] == tag:
            item = self.text_stack.pop()
            text = clean_text("".join(item["text"]))
            if tag in {"h1", "h2", "h3", "h4"} and text:
                self.headings.append({"level": tag, "text": text})
                if self.frame_stack and not self.frame_stack[-1].get("heading"):
                    self.frame_stack[-1]["heading"] = text
            elif tag == "title" and text:
                self.title = text
            elif tag == "button" and self.controls:
                self.controls[-1]["text"] = text
            elif tag == "a" and self.links:
                self.links[-1]["text"] = text

        if self.frame_stack and self.frame_stack[-1]["tag"] == tag:
            self.frame_stack.pop()

    def handle_data(self, data: str) -> None:
        if self.text_stack:
            self.text_stack[-1]["text"].append(data)

    def frame_hint(self, tag: str, attrs: dict[str, str], classes: list[str]) -> str:
        if tag in FRAME_TAGS:
            return tag
        haystack = " ".join([tag, attrs.get("id", ""), attrs.get("class", ""), attrs.get("role", "")]).lower()
        for hint in FRAME_HINTS:
            if hint in haystack:
                return hint
        return ""


def is_real_html(path: Path) -> bool:
    return path.suffix.lower() == ".html" and not path.name.startswith("._")


def page_group(path: Path) -> str:
    parts = path.parts
    if "core" in parts:
        return "renderer-scaffold"
    if "gallery" in parts and "maa_lang" in parts:
        return "maa-lang-gallery"
    if "gallery" in parts:
        return "gallery"
    if "k8" in parts:
        return "k8"
    if "quantum" in parts:
        return "quantum-redirects"
    return "top-level"


def classify_dependency(src: str) -> str:
    if src.startswith("http://") or src.startswith("https://"):
        return "external"
    if src.startswith("/_sdk/"):
        return "missing-local-sdk"
    if src.startswith("/cdn-cgi/"):
        return "cloudflare-snippet"
    if src.startswith("/") or src.startswith("../") or src.startswith("./"):
        return "local"
    return "inline-or-relative"


def parse_html(path: Path, root: Path) -> dict[str, Any]:
    parser = HtmlInventoryParser()
    content = path.read_text(encoding="utf-8", errors="ignore")
    parser.feed(content)

    dependencies = [
        {**item, "kind": classify_dependency(item["src"])}
        for item in parser.dependencies
        if item.get("src")
    ]
    links = parser.links
    hash_links = [item for item in links if item.get("href", "").startswith("#")]
    placeholder_links = [item for item in links if item.get("href") == "#"]
    inline_flags = {
        "cloudflare_challenge": "/cdn-cgi/challenge-platform" in content,
        "element_sdk": "/_sdk/element_sdk.js" in content,
        "data_sdk": "/_sdk/data_sdk.js" in content,
        "tailwind_cdn": "cdn.tailwindcss.com" in content,
        "google_fonts": "fonts.googleapis.com" in content,
    }

    return {
        "path": str(path.resolve().relative_to(root)),
        "group": page_group(path),
        "bytes": path.stat().st_size,
        "title": parser.title,
        "headings": parser.headings[:40],
        "primary_heading": parser.headings[0]["text"] if parser.headings else "",
        "counts": dict(parser.counts),
        "top_classes": parser.classes.most_common(30),
        "top_ids": parser.ids.most_common(20),
        "frames": parser.frames[:80],
        "frame_count": len(parser.frames),
        "controls": parser.controls[:80],
        "control_count": len(parser.controls),
        "links": links[:80],
        "link_count": len(links),
        "hash_link_count": len(hash_links),
        "placeholder_link_count": len(placeholder_links),
        "dependencies": dependencies,
        "dependency_count": len(dependencies),
        "inline_flags": inline_flags,
        "layout_tokens": parser.layout_tokens.most_common(30),
    }


def summarise(pages: list[dict[str, Any]]) -> dict[str, Any]:
    groups = Counter(page["group"] for page in pages)
    tag_counts: Counter[str] = Counter()
    layout_counts: Counter[str] = Counter()
    dependency_kinds: Counter[str] = Counter()
    inline_flags: Counter[str] = Counter()
    frame_hints: Counter[str] = Counter()
    control_tags: Counter[str] = Counter()

    for page in pages:
        tag_counts.update(page["counts"])
        layout_counts.update(dict(page["layout_tokens"]))
        dependency_kinds.update(dep["kind"] for dep in page["dependencies"])
        inline_flags.update(name for name, enabled in page["inline_flags"].items() if enabled)
        frame_hints.update(frame["hint"] for frame in page["frames"] if frame.get("hint"))
        control_tags.update(control["tag"] for control in page["controls"])

    return {
        "page_count": len(pages),
        "groups": groups.most_common(),
        "total_bytes": sum(page["bytes"] for page in pages),
        "tag_counts": tag_counts.most_common(40),
        "layout_tokens": layout_counts.most_common(40),
        "dependency_kinds": dependency_kinds.most_common(),
        "inline_flags": inline_flags.most_common(),
        "frame_hints": frame_hints.most_common(40),
        "control_tags": control_tags.most_common(),
        "total_frames": sum(page["frame_count"] for page in pages),
        "total_controls": sum(page["control_count"] for page in pages),
        "total_links": sum(page["link_count"] for page in pages),
    }


def write_markdown(output: Path, summary: dict[str, Any], pages: list[dict[str, Any]]) -> None:
    largest_pages = sorted(pages, key=lambda page: page["bytes"], reverse=True)[:12]
    page_lines = []
    for page in pages:
        page_lines.append(
            "| {path} | {group} | {heading} | {frames} | {controls} | {links} | {deps} |".format(
                path=page["path"],
                group=page["group"],
                heading=(page["primary_heading"] or "-").replace("|", "\\|"),
                frames=page["frame_count"],
                controls=page["control_count"],
                links=page["link_count"],
                deps=page["dependency_count"],
            )
        )

    def counter_lines(items: list[list[Any] | tuple[Any, Any]]) -> str:
        return "\n".join(f"- `{name}`: {count}" for name, count in items) or "- none"

    content = f"""# HTML UI Inventory

Generated from `assets/html` and `core/renderer/html`.

## Summary

- Pages scanned: {summary["page_count"]}
- Total HTML bytes: {summary["total_bytes"]}
- Data/layout frames detected: {summary["total_frames"]}
- UI controls detected: {summary["total_controls"]}
- Links detected: {summary["total_links"]}

## Page Groups

{counter_lines(summary["groups"])}

## Data Frames

Frame detection uses semantic tags plus class/id hints such as `hero`, `card`,
`panel`, `dashboard`, `widget`, `timeline`, `gallery`, `grid`, `form`, and
`terminal`.

{counter_lines(summary["frame_hints"])}

## UI Elements

{counter_lines(summary["control_tags"])}

## Layout Signals

{counter_lines(summary["layout_tokens"])}

## Dependencies

{counter_lines(summary["dependency_kinds"])}

## Inline Flags

{counter_lines(summary["inline_flags"])}

## Largest Pages

{counter_lines([(page["path"], page["bytes"]) for page in largest_pages])}

## Page Inventory

| Page | Group | Primary heading | Frames | Controls | Links | Dependencies |
| --- | --- | --- | ---: | ---: | ---: | ---: |
{chr(10).join(page_lines)}

## Notes

- `missing-local-sdk` means a page references `/_sdk/...`, which is not present
  in this repository.
- `cloudflare-snippet` means copied Cloudflare challenge code appears in page
  scripts and should be stripped before release use.
- `external` means the page depends on network CDN/font resources.
- AppleDouble files (`._*`) and `.DS_Store` are skipped by the extractor.
"""
    output.write_text(content, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", default="docs/html-ui-inventory.json")
    parser.add_argument("--markdown", default="docs/HTML_UI_INVENTORY.md")
    parser.add_argument("roots", nargs="*", default=["assets/html", "core/renderer/html"])
    args = parser.parse_args()

    root = Path.cwd()
    pages = []
    for html_root in args.roots:
        base = Path(html_root)
        if not base.exists():
            continue
        for path in sorted(base.rglob("*.html")):
            if is_real_html(path):
                pages.append(parse_html(path, root))

    summary = summarise(pages)
    payload = {"summary": summary, "pages": pages}

    json_path = Path(args.json)
    markdown_path = Path(args.markdown)
    json_path.parent.mkdir(parents=True, exist_ok=True)
    markdown_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    write_markdown(markdown_path, summary, pages)

    print(f"scanned {len(pages)} pages")
    print(f"wrote {json_path}")
    print(f"wrote {markdown_path}")


if __name__ == "__main__":
    main()
