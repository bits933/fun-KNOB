#!/usr/bin/env python3
"""One-command build and Windows packaging script for Kreo Dial."""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def resolve_tool(name: str) -> str:
    """Resolve an executable on PATH, preferring Windows .cmd shims when present."""
    candidates = [f"{name}.cmd", name] if os.name == "nt" else [name]
    for candidate in candidates:
        found = shutil.which(candidate)
        if found:
            return found
    sys.exit(f"Error: '{name}' was not found on PATH. Install Node.js (with npm) and try again.")


def clean_env() -> dict[str, str]:
    """Return a subprocess environment safe for Electron tooling."""
    env = os.environ.copy()
    env.pop("ELECTRON_RUN_AS_NODE", None)
    return env


def run_step(label: str, cmd: list[str], env: dict[str, str]) -> None:
    """Execute a build step in ROOT, printing timing and exiting on failure."""
    print(f"\n==> {label}")
    print(f"    $ {' '.join(cmd)}")
    started = time.perf_counter()
    result = subprocess.run(cmd, cwd=ROOT, env=env)
    elapsed = time.perf_counter() - started
    if result.returncode != 0:
        sys.exit(f"\nBuild failed at '{label}' (exit code {result.returncode}).")
    print(f"    Done in {elapsed:.1f}s")


def format_size(num_bytes: int) -> str:
    """Format a byte count into a human-readable string."""
    size = float(num_bytes)
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024.0 or unit == "GB":
            return f"{size:.1f} {unit}" if unit != "B" else f"{int(size)} B"
        size /= 1024.0
    return f"{num_bytes} B"


def print_summary(bundle_only: bool, unpacked_only: bool, total_seconds: float) -> None:
    """Print produced build artifacts and total elapsed time."""
    print(f"\nBuild succeeded in {total_seconds:.1f}s.")
    if bundle_only:
        out_dir = ROOT / "out"
        if out_dir.exists():
            print(f"Bundle output: {out_dir}")
            for entry in sorted(out_dir.rglob("*")):
                if entry.is_file() and entry.suffix in {".js", ".html", ".css"} and entry.parent.name != "assets":
                    print(f"  - {entry.relative_to(ROOT)} ({format_size(entry.stat().st_size)})")
        return

    dist_dir = ROOT / "dist"
    if not dist_dir.exists():
        return

    print(f"Packaged output: {dist_dir}")
    if unpacked_only:
        exe = dist_dir / "win-unpacked" / "Kreo Dial.exe"
        if exe.exists():
            print(f"  - {exe.relative_to(ROOT)} ({format_size(exe.stat().st_size)})")
        return

    for entry in sorted(dist_dir.iterdir()):
        if entry.is_file() and entry.suffix.lower() in {".exe", ".blockmap", ".yml"}:
            print(f"  - {entry.relative_to(ROOT)} ({format_size(entry.stat().st_size)})")


def run_until_closed(cmd: list[str], env: dict[str, str]) -> None:
    """Run cmd in the foreground; on Ctrl+C or exit, kill its whole process tree (Electron included).

    Launching through npx.cmd and returning left node + Electron orphaned: Ctrl+C then only hit the
    batch shim ("Terminate batch job?") and the app kept running.
    """
    proc = subprocess.Popen(cmd, cwd=ROOT, env=env)
    try:
        proc.wait()
    except KeyboardInterrupt:
        print("\nStopping Kreo Dial...")
    finally:
        if proc.poll() is None:
            if os.name == "nt":
                subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"], capture_output=True)
            else:
                proc.kill()
            proc.wait()


def launch_built_app(bundle_only: bool, npx: str, env: dict[str, str]) -> None:
    """Launch the built app after packaging/bundling succeeds."""
    if bundle_only:
        print("\nLaunching preview via electron-vite preview (Ctrl+C to quit)...")
        node = shutil.which("node") or "node"
        run_until_closed([node, str(ROOT / "node_modules" / "electron-vite" / "bin" / "electron-vite.js"), "preview"], env)
        return

    dist_dir = ROOT / "dist"
    unpacked_exe = dist_dir / "win-unpacked" / "Kreo Dial.exe"
    if unpacked_exe.exists():
        print(f"\nLaunching {unpacked_exe}...")
        subprocess.Popen([str(unpacked_exe)], cwd=unpacked_exe.parent, env=env)
        return

    portable_exes = [
        p for p in sorted(dist_dir.glob("*.exe")) if "setup" not in p.name.lower()
    ]
    if portable_exes:
        target = portable_exes[0]
        print(f"\nLaunching {target}...")
        subprocess.Popen([str(target)], cwd=dist_dir, env=env)
        return

    print("\nWarning: Could not find a runnable Kreo Dial executable in dist/.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build, verify, and package Kreo Dial in one command."
    )
    parser.add_argument(
        "target",
        nargs="?",
        help=argparse.SUPPRESS,
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--bundle-only",
        action="store_true",
        help="Build Electron main/preload/renderer bundles in out/ and skip Windows packaging.",
    )
    mode.add_argument(
        "--dir",
        action="store_true",
        help="Build an unpacked Windows directory in dist/win-unpacked/ instead of installers.",
    )
    parser.add_argument(
        "--skip-checks",
        action="store_true",
        help="Skip TypeScript typechecking and Vitest unit tests.",
    )
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Remove out/ and dist/ before building.",
    )
    parser.add_argument(
        "--install",
        action="store_true",
        help="Run npm install before building (automatic if node_modules/ is missing).",
    )
    parser.add_argument(
        "--run",
        action="store_true",
        help="Launch the built app after the build finishes.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    npm = resolve_tool("npm")
    npx = resolve_tool("npx")
    env = clean_env()
    total_start = time.perf_counter()

    if args.clean:
        for folder_name in ("out", "dist"):
            target = ROOT / folder_name
            if target.exists():
                print(f"Cleaning {target}...")
                shutil.rmtree(target)

    if args.install or not (ROOT / "node_modules").exists():
        run_step("Installing npm dependencies", [npm, "install"], env)

    if not args.skip_checks:
        run_step("Typechecking (node + web)", [npm, "run", "typecheck"], env)
        run_step("Running unit tests", [npm, "test"], env)

    run_step("Building Electron & Vite bundles", [npm, "run", "build"], env)

    if not args.bundle_only:
        pkg_cmd = [npx, "electron-builder", "--win"]
        if args.dir:
            pkg_cmd.append("--dir")
        run_step("Packaging Windows app (electron-builder)", pkg_cmd, env)

    print_summary(args.bundle_only, args.dir, time.perf_counter() - total_start)

    if args.run:
        launch_built_app(args.bundle_only, npx, env)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
