#!/usr/bin/env python3
"""Conservative PR-only selection of expensive GitHub Actions CI jobs.

Unknown or sensitive paths select EVERY check; never let ambiguous paths create
an unchecked change. On main and in workflow_call, the workflow always runs
the complete suite regardless of this selection.

GitHub Actions invokes this with the PR base SHA and the checked-out merge
commit, NOT from a user-provided PR title or arbitrary shell expression.
"""
from __future__ import annotations

import argparse
import re
import subprocess
from pathlib import Path

CHECKS = (
    "static", "deployables", "mobile", "computer-browser", "chart",
    "test", "startup", "python-harness", "build", "migrations",
)

ALL = frozenset(CHECKS)

DOC_FILES = {"README.md", "CHANGELOG.md", "CONTRIBUTING.md", "LICENSE", "LICENSE.md"}
PYTHON_HARNESSES = (
    "agent-crewai/", "agent-claude-sdk/", "agent-langgraph-agui/",
    "agent-llamaindex/", "agent-agno/", "agent-adk/",
    "agent-ag2/", "agent-langroid/", "agent-microsoft/",
    "agent-pydantic-ai/", "agent-strands/",
)
BROWSER_PATHS = (
    "agent-computer/", "server/src/computer/", "server/src/auth/",
    "server/src/agents/", "server/src/channels/", "server/src/plugins/",
    "app/src/components/computer/", "app/src/components/channels/",
)
STARTUP_PATHS = (
    "app/tests/build-cache.test.ts", "app/vite.config.ts",
    "app/package.json", "desktop/", "scripts/build",
)
SCHEMA_PATHS = (
    "server/src/db/", "server/drizzle/", "server/drizzle.config.ts",
)
KNOWN_ROOTS = (
    "app/", "server/", "worker/", "desktop/", "mobile/",
    "agent-computer/", "supervisor/", "toolkit/", "charts/",
    "docs/", "scripts/", "examples/", "shared/",
    "agent-", "helm/",
)
GLOBAL_ROOT = {
    "package.json", "bun.lock", "bun.lockb", "tsconfig.json",
    ".github/published-images.json", ".github/zizmor.yml",
}


def checks_for_paths(paths: list[str]) -> frozenset[str]:
    """Return checks required for a change. Fail closed for unknown paths."""
    if not paths:
        return ALL

    selected: set[str] = set()
    for path in paths:
        # Documentation-only changes need no build, DB, browser or expensive
        # matrix jobs. An always-running scope + verify still reports success.
        if path.startswith("docs/") or path in DOC_FILES:
            continue

        # Workflow, scope policy, lockfile, root/shared configuration and
        # unknown paths are security-sensitive: always FULL CI.
        if (
            path.startswith(".github/")
            or path.startswith("scripts/ci-pr-scope")
            # Unclassified agent executables might access secrets or their own
            # runtimes. Only the audited set can use lighter checks.
            or (path.startswith("agent-")
                and not path.startswith(PYTHON_HARNESSES)
                and not path.startswith("agent-computer/"))
            or path in GLOBAL_ROOT
            or path.startswith("shared/")
            or path.startswith("toolkit/")
            or path.startswith("examples/")
            or not path.startswith(KNOWN_ROOTS)
        ):
            return ALL

        selected.add("static")
        if path.startswith(("app/", "server/", "worker/", "agent-", "supervisor/")):
            selected.add("test")
        if path.startswith(("app/", "server/", "worker/", "agent-", "supervisor/")):
            selected.add("build")
        if path.startswith(("agent-computer/", "supervisor/")):
            selected.add("deployables")
        if path.startswith("mobile/"):
            selected.add("mobile")
        if path.startswith("charts/"):
            selected.add("chart")
        if path.startswith(BROWSER_PATHS):
            selected.add("computer-browser")
        if path.startswith(PYTHON_HARNESSES):
            selected.add("python-harness")
        if path.startswith(STARTUP_PATHS):
            selected.add("startup")
        if path.startswith(SCHEMA_PATHS):
            selected.add("migrations")

        # Desktop still has its own Rust CI, with signing restrictions. We
        # preserve static validation here, but do not duplicate other jobs.
        # scripts not known above require full CI, because scripts can be
        # imported by any part of the build or deploy pipeline.
        if path.startswith("scripts/"):
            return ALL

    return frozenset(selected)


def changed_paths(base: str, head: str) -> list[str]:
    for value in (base, head):
        if not re.fullmatch(r"[a-fA-F0-9]{40}", value):
            raise ValueError("A valid Git commit SHA is required.")
    result = subprocess.run(
        ["git", "diff", "--no-renames", "--name-only", "--diff-filter=ACDMRT", f"{base}...{head}"],
        capture_output=True,
        text=True,
        check=True,
    )
    return [p for p in result.stdout.splitlines() if p]


def main() -> None:
    cli = argparse.ArgumentParser()
    cli.add_argument("--base", required=True)
    cli.add_argument("--head", required=True)
    cli.add_argument("--output", type=Path, required=True)
    args = cli.parse_args()
    names = changed_paths(args.base, args.head)
    required = checks_for_paths(names)
    print(f"CI path scope: {len(names)} file(s), required: {', '.join(sorted(required)) or '(docs-only)'}")
    with args.output.open("a", encoding="utf-8") as out:
        for check in CHECKS:
            out.write(f"{check.replace(chr(45), chr(95))}={'true' if check in required else 'false'}\n")


if __name__ == "__main__":
    main()
