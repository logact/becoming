#!/usr/bin/env python3
"""Parse the local M1 Implementation waves without contacting GitHub."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


WAVE_RE = re.compile(r"^### Wave\s+(\d+)\s+[—-]\s+(.+?)\s*$")
TASK_RE = re.compile(
    r"^- \[(?P<mark>[ xX])\]\s+\[#(?P<number>\d+)\]\([^)]+\)\s+[—-]\s+(?P<title>.+?)\s*$"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Read ordered tasks and exit gates from m1-plan.md Implementation waves."
    )
    parser.add_argument("--plan", type=Path, default=Path("m1-plan.md"))
    return parser.parse_args()


def parse_plan(text: str) -> dict[str, Any]:
    start_marker = "## Implementation waves"
    end_marker = "## Milestone closeout"
    if start_marker not in text or end_marker not in text:
        raise ValueError("missing Implementation waves or Milestone closeout section")

    section = text.split(start_marker, 1)[1].split(end_marker, 1)[0]
    waves: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None

    for line_number, line in enumerate(section.splitlines(), start=1):
        wave_match = WAVE_RE.match(line)
        if wave_match:
            current = {
                "number": int(wave_match.group(1)),
                "title": wave_match.group(2),
                "exitGate": None,
                "tasks": [],
            }
            waves.append(current)
            continue

        if current is None:
            continue
        if line.startswith("Exit gate:"):
            current["exitGate"] = line.removeprefix("Exit gate:").strip()
            continue

        task_match = TASK_RE.match(line)
        if task_match:
            number = int(task_match.group("number"))
            current["tasks"].append(
                {
                    "number": number,
                    "title": task_match.group("title"),
                    "localTask": f"#{number} — {task_match.group('title')}",
                    "completed": task_match.group("mark").lower() == "x",
                    "lineInSection": line_number,
                    "suggestedWorktreeName": f"m1-w{current['number']}-task-{number}",
                }
            )

    if not waves:
        raise ValueError("no implementation waves found")
    expected_wave_numbers = list(range(1, 14))
    actual_wave_numbers = [wave["number"] for wave in waves]
    if actual_wave_numbers != expected_wave_numbers:
        raise ValueError(
            f"expected waves {expected_wave_numbers}, found {actual_wave_numbers}"
        )

    task_numbers: list[int] = []
    for wave in waves:
        if not wave["exitGate"]:
            raise ValueError(f"Wave {wave['number']} has no Exit gate")
        if not wave["tasks"]:
            raise ValueError(f"Wave {wave['number']} has no tasks")
        task_numbers.extend(task["number"] for task in wave["tasks"])
    if len(task_numbers) != len(set(task_numbers)):
        raise ValueError("duplicate task numbers found in Implementation waves")

    ordered_tasks = [
        {
            **task,
            "wave": wave["number"],
            "waveTitle": wave["title"],
            "waveExitGate": wave["exitGate"],
        }
        for wave in waves
        for task in wave["tasks"]
    ]
    pending = [task for task in ordered_tasks if not task["completed"]]

    return {
        "waveCount": len(waves),
        "taskCount": len(ordered_tasks),
        "completedCount": len(ordered_tasks) - len(pending),
        "pendingCount": len(pending),
        "nextTask": pending[0] if pending else None,
        "waves": waves,
    }


def main() -> int:
    args = parse_args()
    try:
        result = parse_plan(args.plan.read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
