"""Copy the Dynamics Forge CAD used by the portfolio's browser demos."""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = Path(r"C:\Dev\Web_RL_Win_Lix_Cpp")
DESTINATION = PROJECT_ROOT / "assets" / "models" / "dynamics-forge"
CAD_ASSETS = (
    "forearm.stl",
    "link.stl",
    "MotorPropCCW.STL",
    "MotorPropCW.STL",
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Sync the selected Dynamics Forge STL files into the static portfolio."
    )
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    args = parser.parse_args()

    source_directory = args.source.resolve() / "stl"
    missing = [name for name in CAD_ASSETS if not (source_directory / name).is_file()]
    if missing:
        raise SystemExit(f"Missing CAD assets in {source_directory}: {', '.join(missing)}")

    DESTINATION.mkdir(parents=True, exist_ok=True)
    for name in CAD_ASSETS:
        source = source_directory / name
        destination = DESTINATION / name
        shutil.copy2(source, destination)
        print(f"Synced {source.name} ({destination.stat().st_size} bytes)")

    print(f"Dynamics Forge web CAD is current in {DESTINATION}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
