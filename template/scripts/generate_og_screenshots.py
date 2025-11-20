#!/usr/bin/env python3
"""
generate_og_screenshots.py

Create OG images by taking screenshots of each route defined in seo.json.

Usage:
    python scripts/generate_og_screenshots.py --host localhost --port 5173 --seo seo.json

Requirements:
  pip install -r scripts/requirements.txt
  playwright install

What it does:
  - Reads `seo.json` and scans for entries that include `ogImage` (e.g. `/images/og/og-home.webp`).
  - Checks whether the referenced file exists in `public/`.
  - If missing, opens the route at `http://{host}:{port}{routePath}`, screenshots the viewport sized 1200x630, and saves as webp to the target path.

Notes:
    - Defaults to `localhost:5173` since a server is expected to be running.
  - Uses Playwright to render pages (headless), wait for network idle, and capture a screenshot.
"""
import argparse
import json
import os
import sys
import asyncio
from pathlib import Path
from typing import Dict, Any

from PIL import Image
from playwright.async_api import async_playwright


def parse_args():
    parser = argparse.ArgumentParser(description='Generate OG screenshots from routes in seo.json')
    parser.add_argument('--host', default='localhost', help='Local server host (default: localhost)')
    parser.add_argument('--port', default=5173, type=int, help='Local server port (default: 5173)')
    parser.add_argument('--cleanup', action='store_true', help='Delete orphaned OG images not referenced in seo.json')
    parser.add_argument('--dry-run', action='store_true', help='When used with --cleanup, list files that would be deleted without deleting')
    parser.add_argument('--seo', default='seo.json', help='Path to seo.json')
    parser.add_argument('--out', default='public', help='Output dir for images (default: public)')
    parser.add_argument('--overwrite', action='store_true', help='Overwrite existing images')
    args = parser.parse_args()
    return args


def read_seo(seo_path: str) -> Dict[str, Any]:
    with open(seo_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def ensure_dir_for_file(filepath: Path):
    dirpath = filepath.parent
    if not dirpath.exists():
        dirpath.mkdir(parents=True, exist_ok=True)


async def capture_page_to_webp(page, url: str, dest_path: Path, viewport=(1200, 630)):
    print(f"Navigating to {url}")
    await page.set_viewport_size({'width': viewport[0], 'height': viewport[1]})
    response = await page.goto(url, wait_until='networkidle', timeout=30000)
    if response is None or not (200 <= response.status < 400):
        print(f"Warning: Received status {response.status if response else 'None'} for {url}")
    # Wait a bit for dynamic content and animations to settle
    await asyncio.sleep(1.2)
    tmp_png = dest_path.with_suffix('.png')
    await page.screenshot(path=str(tmp_png), type='png', full_page=False)
    # Convert to webp using Pillow
    img = Image.open(tmp_png)
    img.save(dest_path, 'WEBP', quality=90, method=6)
    tmp_png.unlink()
    print(f"Saved OG image to {dest_path}")


async def generate_images(host: str, port: int, seo_path: str, out_dir: str, overwrite: bool):
    seo = read_seo(seo_path)
    base_url = f"http://{host}:{port}"
    # Collect routes: keys in seo that start with '/'
    routes = [k for k in seo.keys() if k.startswith('/')]

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1200, 'height': 630})
        page = await context.new_page()

        for route in routes:
            # Skip only if route is '/'
            if route == '':
                continue
            config = seo.get(route, {})
            og_image = config.get('ogImage')
            if not og_image:
                print(f"Skipping {route}: no ogImage configured")
                continue

            # Determine local filepath for OG image
            # ogImage may be '/images/og/og-home.webp'
            if og_image.startswith('/'):
                dest_rel = og_image[1:]
            else:
                dest_rel = og_image

            dest_path = Path(out_dir) / dest_rel
            if dest_path.exists() and not overwrite:
                # print(f"OG image already exists for {route}, skipping: {dest_path}")
                continue

            # Ensure directory exists
            ensure_dir_for_file(dest_path)

            url = base_url + (route if route.startswith('/') else '/' + route)
            try:
                await capture_page_to_webp(page, url, dest_path)
            except Exception as e:
                print(f"Error capturing {url}: {e}")

        await browser.close()


def get_referenced_images_from_seo(seo: Dict[str, Any]) -> set:
    referenced = set()
    for route, config in seo.items():
            if not isinstance(config, dict):
                continue
            og = config.get('ogImage')
            if og and isinstance(og, str):
                if og.startswith('/'):
                    referenced.add(og[1:])
                else:
                    referenced.add(og)
    # Include global default image and logo
    global_conf = seo.get('_global', {})
    if isinstance(global_conf, dict):
        for key in ('defaultImage', 'logo'):
            val = global_conf.get(key)
            if val and isinstance(val, str):
                referenced.add(val[1:] if val.startswith('/') else val)
    # Normalize to lower-case for case-insensitive comparisons
    normalized = {p.replace('\\', '/').lower() for p in referenced}
    return normalized


def cleanup_orphaned_images(out_dir: str, referenced: set, dry_run: bool = True):
    # We'll only consider webp images under out_dir/images/**
    out = Path(out_dir)
    images_root = out / 'images'
    to_delete = []

    # Check images folder for files starting with og-
    if images_root.exists():
        for root, _, files in os.walk(images_root):
            for fname in files:
                if not fname.lower().endswith('.webp'):
                    continue
                # only consider files with 'og-' prefix in the filename
                if not fname.startswith('og-'):
                    continue
                rel = os.path.relpath(os.path.join(root, fname), out_dir)
                norm = rel.replace('\\', '/').lower()
                if norm not in referenced:
                    to_delete.append(Path(root) / fname)

    if not to_delete:
        # print('No orphaned OG images found to delete.')
        return

    # Delete or show them
    for p in to_delete:
        if dry_run:
            print(f"[DRYRUN] Would delete: {p}")
        else:
            try:
                p.unlink()
                print(f"Deleted: {p}")
            except Exception as e:
                print(f"Failed to delete {p}: {e}")


def main():
    args = parse_args()
    seo_path = args.seo
    if not os.path.exists(seo_path):
        print(f"seo.json not found at {seo_path}")
        sys.exit(1)

    # Ensure Playwright is installed and browsers are set up
    # This script assumes `playwright install` has been run.

    # Run generation and optional cleanup
    asyncio.run(generate_images(args.host, args.port, seo_path, args.out, args.overwrite))
    if args.cleanup:
        seo = read_seo(seo_path)
        referenced = get_referenced_images_from_seo(seo)
        cleanup_orphaned_images(args.out, referenced, dry_run=args.dry_run)


if __name__ == '__main__':
    main()
