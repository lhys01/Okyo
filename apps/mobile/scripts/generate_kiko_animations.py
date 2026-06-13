#!/usr/bin/env python3
"""Generate simple 2D Kiko animation assets for Okyo.

Requirements:
  python3 -m pip install pillow imageio imageio-ffmpeg

Run from apps/mobile:
  python3 scripts/generate_kiko_animations.py
"""

from __future__ import annotations

import math
import shutil
from dataclasses import dataclass
from pathlib import Path

try:
    import imageio.v2 as imageio
    import numpy as np
    from PIL import Image, ImageDraw, ImageFilter
except ImportError as exc:
    raise SystemExit(
        "Missing animation dependencies. Install them with:\n"
        "  python3 -m pip install pillow imageio imageio-ffmpeg"
    ) from exc


CANVAS_SIZE = 384
FPS = 12
DURATION_SECONDS = 3.0
FRAME_COUNT = int(FPS * DURATION_SECONDS)

CREAM = (250, 247, 240, 255)
CARD = (255, 255, 255, 255)
CORAL = (233, 85, 47, 255)
CORAL_SOFT = (253, 238, 231, 255)
GREEN = (29, 122, 77, 255)
GREEN_SOFT = (233, 245, 238, 255)
CHARCOAL = (28, 24, 19, 255)
MUTED = (142, 134, 123, 255)
CREAM_DEEP = (234, 223, 203, 255)
YELLOW = (250, 191, 88, 255)


@dataclass(frozen=True)
class AnimationSpec:
    slug: str
    title: str
    purpose: str
    source_asset: str
    renderer_name: str


ANIMATIONS = [
    AnimationSpec(
        slug="kiko-cooking-pan-saute",
        title="Kiko cooking with a pan",
        purpose="Use for active cooking, sauteing, or recipe-in-progress moments.",
        source_asset="kiko-cooking.png",
        renderer_name="pan_saute",
    ),
    AnimationSpec(
        slug="kiko-cutting-vegetables",
        title="Kiko cutting vegetables",
        purpose="Use for prep, chopping, ingredient, or mise en place moments.",
        source_asset="kiko-side-profile.png",
        renderer_name="cutting",
    ),
    AnimationSpec(
        slug="kiko-scanning",
        title="Kiko scanning",
        purpose="Use while Okyo analyzes an uploaded food or drink photo.",
        source_asset="kiko-scanning.png",
        renderer_name="scanning",
    ),
    AnimationSpec(
        slug="kiko-cooking-stirring",
        title="Kiko cooking and stirring",
        purpose="Use for simmering, stirring, and recipe-building moments.",
        source_asset="kiko-cooking.png",
        renderer_name="stirring",
    ),
    AnimationSpec(
        slug="kiko-success-celebration",
        title="Kiko success celebration",
        purpose="Use for scan success, recipe saved, challenge complete, or progress wins.",
        source_asset="kiko-celebrating.png",
        renderer_name="celebration",
    ),
    AnimationSpec(
        slug="kiko-grocery-bag",
        title="Kiko grocery bag",
        purpose="Use for grocery list, shopping, and pantry planning moments.",
        source_asset="kiko-grocery-list.png",
        renderer_name="grocery",
    ),
]


def main() -> None:
    mobile_root = Path(__file__).resolve().parents[1]
    mascot_dir = mobile_root / "assets" / "mascot" / "kiko_transparent_backgrounds_careful"
    fallback_mascot_dir = mobile_root / "assets" / "mascot"
    output_dir = mobile_root / "assets" / "animations"
    frames_root = output_dir / "frames"
    output_dir.mkdir(parents=True, exist_ok=True)
    frames_root.mkdir(parents=True, exist_ok=True)

    generated = []
    for spec in ANIMATIONS:
        source_path = mascot_dir / spec.source_asset
        if not source_path.exists():
            source_path = fallback_mascot_dir / spec.source_asset
        if not source_path.exists():
            raise FileNotFoundError(f"Missing Kiko source asset: {spec.source_asset}")

        source_image = load_kiko(source_path)
        frames = render_animation(spec.renderer_name, source_image)
        frame_dir = frames_root / spec.slug
        if frame_dir.exists():
            shutil.rmtree(frame_dir)
        frame_dir.mkdir(parents=True, exist_ok=True)

        for index, frame in enumerate(frames):
            frame.save(frame_dir / f"{spec.slug}_frame_{index:03d}.png", optimize=True)

        gif_path = output_dir / f"{spec.slug}.gif"
        mp4_path = output_dir / f"{spec.slug}.mp4"
        save_gif(frames, gif_path)
        save_mp4(frames, mp4_path)

        generated.append(
            {
                "spec": spec,
                "gif": gif_path,
                "mp4": mp4_path,
                "frames": frame_dir,
                "frame_count": len(frames),
                "source": source_path,
            }
        )

    write_readme(output_dir, generated)
    print(f"Generated {len(generated)} Kiko animations in {output_dir}")


def load_kiko(path: Path) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    alpha_bbox = image.getchannel("A").getbbox()
    return image.crop(alpha_bbox) if alpha_bbox else image


def render_animation(renderer_name: str, kiko: Image.Image) -> list[Image.Image]:
    renderers = {
        "pan_saute": render_pan_saute,
        "cutting": render_cutting,
        "scanning": render_scanning,
        "stirring": render_stirring,
        "celebration": render_celebration,
        "grocery": render_grocery,
    }
    renderer = renderers[renderer_name]
    return [renderer(kiko, index, FRAME_COUNT) for index in range(FRAME_COUNT)]


def base_canvas() -> Image.Image:
    return Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))


def phase(index: int, total: int) -> float:
    return index / total


def wave(index: int, total: int, cycles: float = 1.0, offset: float = 0.0) -> float:
    return math.sin((phase(index, total) * cycles + offset) * math.tau)


def add_shadow(canvas: Image.Image, center_x: int, center_y: int, width: int, height: int, opacity: int = 42) -> None:
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.ellipse(
        (
            center_x - width // 2,
            center_y - height // 2,
            center_x + width // 2,
            center_y + height // 2,
        ),
        fill=(74, 58, 40, opacity),
    )
    overlay = overlay.filter(ImageFilter.GaussianBlur(8))
    canvas.alpha_composite(overlay)


def paste_kiko(
    canvas: Image.Image,
    kiko: Image.Image,
    center: tuple[int, int],
    height: int,
    angle: float = 0.0,
) -> None:
    scaled = kiko.copy()
    ratio = height / scaled.height
    scaled = scaled.resize((int(scaled.width * ratio), height), Image.Resampling.LANCZOS)
    if abs(angle) > 0.01:
        scaled = scaled.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
    x = int(center[0] - scaled.width / 2)
    y = int(center[1] - scaled.height / 2)
    canvas.alpha_composite(scaled, (x, y))


def render_pan_saute(kiko: Image.Image, index: int, total: int) -> Image.Image:
    canvas = base_canvas()
    bounce = int(5 * wave(index, total, 2))
    add_shadow(canvas, 192, 334, 180, 24)
    paste_kiko(canvas, kiko, (190, 178 + bounce), 250, angle=2.0 * wave(index, total, 1))

    draw_pan(canvas, 190, 295, tilt=4 * wave(index, total, 2))
    draw_steam(canvas, 165, 242, index, total)
    draw_food_flip(canvas, index, total)
    return canvas


def render_cutting(kiko: Image.Image, index: int, total: int) -> Image.Image:
    canvas = base_canvas()
    bounce = int(4 * wave(index, total, 2))
    add_shadow(canvas, 190, 334, 170, 22)
    paste_kiko(canvas, kiko, (190, 178 + bounce), 244, angle=1.5 * wave(index, total, 1))
    draw_cutting_board(canvas, 192, 302)
    draw_vegetables(canvas, index, total)
    draw_knife(canvas, 198, 266, angle=-18 + 26 * abs(wave(index, total, 3)))
    return canvas


def render_scanning(kiko: Image.Image, index: int, total: int) -> Image.Image:
    canvas = base_canvas()
    scan = (phase(index, total) * 2) % 1
    pulse = 1 + 0.035 * wave(index, total, 2)
    add_scan_glow(canvas, scan)
    add_shadow(canvas, 192, 334, 172, 22, opacity=36)
    paste_kiko(canvas, kiko, (192, 189 + int(4 * wave(index, total, 2))), int(252 * pulse))
    draw_scan_line(canvas, scan)
    draw_sparkles(canvas, index, total, [(92, 112), (295, 126), (88, 244), (305, 258)])
    return canvas


def render_stirring(kiko: Image.Image, index: int, total: int) -> Image.Image:
    canvas = base_canvas()
    bounce = int(3 * wave(index, total, 2))
    add_shadow(canvas, 192, 335, 170, 22)
    paste_kiko(canvas, kiko, (188, 179 + bounce), 248, angle=1.2 * wave(index, total, 1))
    draw_pot(canvas, 195, 300)
    draw_spoon(canvas, 195, 278, angle=-22 + 44 * ((wave(index, total, 2) + 1) / 2))
    draw_steam(canvas, 196, 244, index + 5, total)
    return canvas


def render_celebration(kiko: Image.Image, index: int, total: int) -> Image.Image:
    canvas = base_canvas()
    bounce = int(-9 * abs(wave(index, total, 2)))
    add_shadow(canvas, 192, 338, 174, 22)
    draw_confetti(canvas, index, total)
    paste_kiko(canvas, kiko, (192, 188 + bounce), 260, angle=3.0 * wave(index, total, 2))
    draw_sparkles(canvas, index, total, [(84, 94), (296, 90), (68, 230), (316, 230)])
    return canvas


def render_grocery(kiko: Image.Image, index: int, total: int) -> Image.Image:
    canvas = base_canvas()
    bounce = int(4 * wave(index, total, 2))
    add_shadow(canvas, 192, 336, 180, 22)
    paste_kiko(canvas, kiko, (172, 180 + bounce), 242, angle=1.4 * wave(index, total, 1))
    draw_grocery_bag(canvas, 248, 286 + int(5 * wave(index, total, 2, 0.1)), index, total)
    draw_sparkles(canvas, index, total, [(298, 156), (294, 220)])
    return canvas


def draw_pan(canvas: Image.Image, x: int, y: int, tilt: float = 0.0) -> None:
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.rounded_rectangle((x - 70, y - 10, x + 58, y + 20), radius=16, fill=CHARCOAL)
    draw.rounded_rectangle((x - 60, y - 18, x + 48, y + 8), radius=13, fill=(64, 57, 49, 255))
    draw.rounded_rectangle((x + 44, y - 8, x + 100, y + 4), radius=7, fill=CHARCOAL)
    if abs(tilt) > 0.01:
        overlay = overlay.rotate(tilt, resample=Image.Resampling.BICUBIC, center=(x, y), expand=False)
    canvas.alpha_composite(overlay)


def draw_food_flip(canvas: Image.Image, index: int, total: int) -> None:
    draw = ImageDraw.Draw(canvas)
    t = phase(index, total)
    for offset, color in [(0.0, CORAL), (0.25, GREEN), (0.5, YELLOW), (0.75, CREAM_DEEP)]:
        local = (t * 2 + offset) % 1
        x = 146 + int(local * 82)
        y = 266 - int(math.sin(local * math.pi) * 40)
        draw.ellipse((x - 5, y - 4, x + 5, y + 4), fill=color)


def draw_cutting_board(canvas: Image.Image, x: int, y: int) -> None:
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((x - 94, y - 22, x + 94, y + 24), radius=18, fill=(241, 220, 187, 255))
    draw.rounded_rectangle((x - 82, y - 14, x + 82, y + 16), radius=12, outline=(214, 185, 144, 255), width=2)


def draw_vegetables(canvas: Image.Image, index: int, total: int) -> None:
    draw = ImageDraw.Draw(canvas)
    wiggle = int(2 * wave(index, total, 3))
    pieces = [
        (142, 293, GREEN),
        (158, 299 + wiggle, GREEN),
        (178, 289, CORAL),
        (208, 300 - wiggle, CORAL),
        (228, 290, YELLOW),
    ]
    for x, y, color in pieces:
        draw.rounded_rectangle((x - 8, y - 5, x + 8, y + 5), radius=4, fill=color)


def draw_knife(canvas: Image.Image, x: int, y: int, angle: float) -> None:
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.polygon([(x - 42, y), (x + 30, y - 12), (x + 22, y + 6), (x - 44, y + 9)], fill=(221, 224, 222, 255))
    draw.rounded_rectangle((x + 24, y - 13, x + 55, y + 7), radius=6, fill=CHARCOAL)
    overlay = overlay.rotate(angle, resample=Image.Resampling.BICUBIC, center=(x, y + 24), expand=False)
    canvas.alpha_composite(overlay)


def add_scan_glow(canvas: Image.Image, scan: float) -> None:
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for radius, alpha in [(122, 26), (104, 34), (86, 42)]:
        draw.rounded_rectangle(
            (192 - radius, 84, 192 + radius, 304),
            radius=34,
            outline=(233, 85, 47, alpha),
            width=3,
        )
    overlay = overlay.filter(ImageFilter.GaussianBlur(1.2))
    canvas.alpha_composite(overlay)


def draw_scan_line(canvas: Image.Image, scan: float) -> None:
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    y = 104 + int(scan * 178)
    draw.rounded_rectangle((82, y - 3, 302, y + 3), radius=4, fill=(233, 85, 47, 140))
    draw.rounded_rectangle((92, y - 12, 292, y + 12), radius=16, outline=(233, 85, 47, 38), width=3)
    canvas.alpha_composite(overlay)


def draw_pot(canvas: Image.Image, x: int, y: int) -> None:
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((x - 62, y - 20, x + 62, y + 26), radius=18, fill=CHARCOAL)
    draw.rounded_rectangle((x - 48, y - 28, x + 48, y - 10), radius=12, fill=(72, 64, 54, 255))
    draw.rounded_rectangle((x - 82, y - 14, x - 58, y + 6), radius=9, fill=CHARCOAL)
    draw.rounded_rectangle((x + 58, y - 14, x + 82, y + 6), radius=9, fill=CHARCOAL)
    draw.ellipse((x - 36, y - 18, x + 36, y + 2), fill=(255, 245, 232, 255))


def draw_spoon(canvas: Image.Image, x: int, y: int, angle: float) -> None:
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.rounded_rectangle((x - 5, y - 80, x + 5, y + 22), radius=5, fill=(143, 100, 58, 255))
    draw.ellipse((x - 13, y + 13, x + 13, y + 35), fill=(143, 100, 58, 255))
    overlay = overlay.rotate(angle, resample=Image.Resampling.BICUBIC, center=(x, y + 25), expand=False)
    canvas.alpha_composite(overlay)


def draw_steam(canvas: Image.Image, x: int, y: int, index: int, total: int) -> None:
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    t = phase(index, total)
    for stream in range(3):
        local = (t * 2 + stream / 3) % 1
        sx = x + (stream - 1) * 24 + int(5 * math.sin(local * math.tau))
        sy = y - int(local * 42)
        alpha = int(72 * (1 - local))
        draw.arc((sx - 11, sy - 28, sx + 17, sy + 24), 108, 248, fill=(142, 134, 123, alpha), width=3)
    canvas.alpha_composite(overlay)


def draw_confetti(canvas: Image.Image, index: int, total: int) -> None:
    draw = ImageDraw.Draw(canvas)
    palette = [CORAL, GREEN, YELLOW, CREAM_DEEP]
    for confetti_index in range(28):
        seed = confetti_index * 37
        t = (phase(index, total) + (seed % 17) / 17) % 1
        x = 42 + ((seed * 11) % 300)
        y = 42 + int(t * 252)
        drift = int(math.sin(t * math.tau + confetti_index) * 12)
        color = palette[confetti_index % len(palette)]
        draw.rounded_rectangle((x + drift, y, x + drift + 7, y + 10), radius=2, fill=color)


def draw_grocery_bag(canvas: Image.Image, x: int, y: int, index: int, total: int) -> None:
    draw = ImageDraw.Draw(canvas)
    sway = int(4 * wave(index, total, 2))
    draw.rounded_rectangle((x - 38 + sway, y - 44, x + 38 + sway, y + 36), radius=14, fill=(236, 210, 171, 255))
    draw.arc((x - 22 + sway, y - 60, x + 22 + sway, y - 18), 180, 360, fill=(177, 132, 82, 255), width=5)
    draw.rounded_rectangle((x - 26 + sway, y - 74, x - 12 + sway, y - 34), radius=6, fill=(235, 183, 100, 255))
    draw.rounded_rectangle((x - 3 + sway, y - 66, x + 11 + sway, y - 34), radius=6, fill=GREEN)
    draw.polygon([(x + 18 + sway, y - 66), (x + 44 + sway, y - 56), (x + 26 + sway, y - 35)], fill=CORAL)
    draw.ellipse((x + 23 + sway, y - 61, x + 35 + sway, y - 49), fill=GREEN)
    draw.rounded_rectangle((x - 21 + sway, y - 4, x + 22 + sway, y + 10), radius=5, fill=(255, 238, 213, 255))


def draw_sparkles(canvas: Image.Image, index: int, total: int, points: list[tuple[int, int]]) -> None:
    draw = ImageDraw.Draw(canvas)
    for point_index, (x, y) in enumerate(points):
        local = (phase(index, total) * 2 + point_index * 0.25) % 1
        size = 4 + int(5 * abs(math.sin(local * math.pi)))
        alpha = int(210 * abs(math.sin(local * math.pi)))
        color = (233, 85, 47, alpha) if point_index % 2 == 0 else (29, 122, 77, alpha)
        draw.line((x - size, y, x + size, y), fill=color, width=2)
        draw.line((x, y - size, x, y + size), fill=color, width=2)
        draw.ellipse((x - 2, y - 2, x + 2, y + 2), fill=color)


def save_gif(frames: list[Image.Image], path: Path) -> None:
    duration_ms = int(1000 / FPS)
    frames[0].save(
        path,
        save_all=True,
        append_images=frames[1:],
        duration=duration_ms,
        loop=0,
        disposal=2,
        optimize=True,
    )


def save_mp4(frames: list[Image.Image], path: Path) -> None:
    writer = imageio.get_writer(
        path,
        fps=FPS,
        codec="libx264",
        quality=7,
        macro_block_size=16,
        ffmpeg_log_level="error",
    )
    try:
        for frame in frames:
            writer.append_data(np.asarray(composite_over_cream(frame).convert("RGB")))
    finally:
        writer.close()


def composite_over_cream(frame: Image.Image) -> Image.Image:
    background = Image.new("RGBA", frame.size, CREAM)
    background.alpha_composite(frame)
    return background


def write_readme(output_dir: Path, generated: list[dict[str, object]]) -> None:
    lines = [
        "# Kiko Animation Assets",
        "",
        "Generated 2D Kiko animation files for Okyo. GIFs and PNG frame sequences use transparent backgrounds; MP4s are composited on warm cream because MP4 does not preserve alpha.",
        "",
        "## Regenerate",
        "",
        "From `apps/mobile`:",
        "",
        "```sh",
        "python3 -m pip install pillow imageio imageio-ffmpeg",
        "python3 scripts/generate_kiko_animations.py",
        "```",
        "",
        "## Files",
        "",
    ]

    for item in generated:
        spec = item["spec"]
        assert isinstance(spec, AnimationSpec)
        gif_path = item["gif"]
        mp4_path = item["mp4"]
        frame_dir = item["frames"]
        source = item["source"]
        assert isinstance(gif_path, Path)
        assert isinstance(mp4_path, Path)
        assert isinstance(frame_dir, Path)
        assert isinstance(source, Path)
        lines.extend(
            [
                f"### {spec.title}",
                "",
                f"- Use: {spec.purpose}",
                f"- Duration: {DURATION_SECONDS:.1f}s loop at {FPS}fps",
                f"- Size: {CANVAS_SIZE}x{CANVAS_SIZE}",
                f"- Source Kiko asset: `{relative_to_mobile(source)}`",
                f"- GIF: `{relative_to_mobile(gif_path)}` ({format_bytes(gif_path.stat().st_size)})",
                f"- MP4: `{relative_to_mobile(mp4_path)}` ({format_bytes(mp4_path.stat().st_size)})",
                f"- PNG frames: `{relative_to_mobile(frame_dir)}/` ({item['frame_count']} frames)",
                "",
            ]
        )

    (output_dir / "README.md").write_text("\n".join(lines), encoding="utf-8")


def relative_to_mobile(path: Path) -> str:
    mobile_root = Path(__file__).resolve().parents[1]
    return str(path.resolve().relative_to(mobile_root))


def format_bytes(size: int) -> str:
    if size < 1024:
        return f"{size} B"
    if size < 1024 * 1024:
        return f"{size / 1024:.1f} KB"
    return f"{size / (1024 * 1024):.1f} MB"


if __name__ == "__main__":
    main()
