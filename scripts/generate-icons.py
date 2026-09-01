#!/usr/bin/env python3
"""Generate simple PWA PNG icons without third-party dependencies."""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "static"
PURPLE = (0, 104, 116)
GOLD = (255, 213, 79)
CLOUD = (204, 232, 233)


def chunk(tag: bytes, data: bytes) -> bytes:
	return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def write_png(path: Path, size: number, pixels: list[tuple[int, int, int]]) -> None:
	raw = b"".join(b"\x00" + b"".join(bytes(px) for px in pixels[y * size : (y + 1) * size]) for y in range(size))
	png = b"".join(
		[
			b"\x89PNG\r\n\x1a\n",
			chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)),
			chunk(b"IDAT", zlib.compress(raw, 9)),
			chunk(b"IEND", b""),
		]
	)
	path.write_bytes(png)


def draw(size: int) -> list[tuple[int, int, int]]:
	pixels: list[tuple[int, int, int]] = []
	radius = size * 0.22
	sun = (size * 0.36, size * 0.36)
	cloud_cy = size * 0.68
	for y in range(size):
		for x in range(size):
			dx = x - sun[0]
			dy = y - sun[1]
			if dx * dx + dy * dy <= radius * radius:
				pixels.append(GOLD)
				continue
			in_cloud = False
			for cx, scale in ((0.38, 0.16), (0.52, 0.2), (0.68, 0.17)):
				cdx = x - size * cx
				cdy = y - cloud_cy
				if cdx * cdx + cdy * cdy <= (size * scale) ** 2:
					in_cloud = True
					break
			pixels.append(CLOUD if in_cloud else PURPLE)
	return pixels


def main() -> None:
	ROOT.mkdir(parents=True, exist_ok=True)
	for size, name in ((192, "pwa-192x192.png"), (512, "pwa-512x512.png"), (180, "apple-touch-icon.png")):
		write_png(ROOT / name, size, draw(size))


if __name__ == "__main__":
	main()
