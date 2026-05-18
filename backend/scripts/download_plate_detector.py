from __future__ import annotations

from pathlib import Path
import sys

import requests


MODEL_URL = "https://huggingface.co/Koushim/yolov8-license-plate-detection/resolve/main/best.pt"
TARGET_PATH = Path(__file__).resolve().parent.parent / "models" / "license_plate_yolov8.pt"
CHUNK_SIZE = 1024 * 1024


def main() -> int:
    TARGET_PATH.parent.mkdir(parents=True, exist_ok=True)

    if TARGET_PATH.exists() and TARGET_PATH.stat().st_size > 0:
        print(f"Modelo ja disponivel em {TARGET_PATH}")
        return 0

    print(f"Baixando detector de placa para {TARGET_PATH}...")
    response = requests.get(MODEL_URL, stream=True, timeout=120)
    response.raise_for_status()

    with TARGET_PATH.open("wb") as handle:
        for chunk in response.iter_content(chunk_size=CHUNK_SIZE):
            if chunk:
                handle.write(chunk)

    print(f"Download concluido: {TARGET_PATH}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # pragma: no cover - CLI guard
        print(f"Falha ao baixar detector de placa: {exc}", file=sys.stderr)
        raise SystemExit(1)