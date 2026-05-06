#!/usr/bin/env python3
"""Generate simple PNG markers for MapLibre SymbolLayer (no external deps)."""
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "map"


def write_png(path: Path, w: int, h: int, get_rgba):
    rows = []
    for y in range(h):
        row = bytearray()
        for x in range(w):
            row.extend(get_rgba(x, y))
        rows.append(bytes(row))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + r for r in rows)
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def main():
    R, WHT, TEAL, ORG, BLU = (234, 67, 53, 255), (255, 255, 255, 255), (0, 168, 107, 255), (251, 140, 0, 255), (26, 115, 232, 255)

    # Client: red circle + white building (roof + block + door cut)
    wc = 72
    cx = (wc - 1) / 2
    cy = (wc - 1) / 2

    def client_px(x, y):
        d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
        if d > 33:
            return bytes([0, 0, 0, 0])
        c = R
        # Pitched roof (readable as “building” on map)
        if 10 <= y < 24:
            half = 6 + (y - 10)
            if abs(x - cx) <= half + 0.5:
                c = WHT
        # Facade
        if 24 <= y < 56 and 16 <= x < 56:
            c = WHT
        # Door
        if 40 <= y < 56 and 34 <= x < 46:
            c = R
        return bytes(c)

    write_png(OUT / "marker-client.png", wc, wc, client_px)

    # Guard: blue disk, white ring, blue inner
    wg = 64
    cg = (wg - 1) / 2

    def guard_px(x, y):
        d = ((x - cg) ** 2 + (y - cg) ** 2) ** 0.5
        if d > 30:
            return bytes([0, 0, 0, 0])
        if d > 22:
            return bytes(WHT)
        if d > 10:
            return bytes(BLU)
        return bytes(WHT)

    write_png(OUT / "marker-guard.png", wg, wg, guard_px)

    # Me: teal crosshair + center dot (distinct from building)
    wm = 64
    cm = (wm - 1) / 2

    def me_px(x, y):
        dx, dy = x - cm, y - cm
        adx, ady = abs(dx), abs(dy)
        d = (dx * dx + dy * dy) ** 0.5
        if d > 29:
            return bytes([0, 0, 0, 0])
        if d < 6:
            return bytes(TEAL)
        if 20 < d < 25:
            return bytes(TEAL)
        if adx < 2.2 and ady < 22:
            return bytes(TEAL)
        if ady < 2.2 and adx < 22:
            return bytes(TEAL)
        return bytes([0, 0, 0, 0])

    write_png(OUT / "marker-me.png", wm, wm, me_px)

    # Playback orange
    wp = 48
    cp = (wp - 1) / 2

    def play_px(x, y):
        d = ((x - cp) ** 2 + (y - cp) ** 2) ** 0.5
        if d > 22:
            return bytes([0, 0, 0, 0])
        if d > 14:
            return bytes(WHT)
        return bytes(ORG)

    write_png(OUT / "marker-playback.png", wp, wp, play_px)
    print("Wrote markers to", OUT)


if __name__ == "__main__":
    main()
