#!/usr/bin/env bash
# Regenerates the raster icons in public/ from the brand SVG sources.
# Requires rsvg-convert and ImageMagick (`brew install librsvg imagemagick`).
set -euo pipefail

cd "$(dirname "$0")/../.."
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# Favicon rasters come from the small-size mark (light-scheme colors).
rsvg-convert -w 16 -h 16 public/favicon.svg -o public/favicon-16x16.png
rsvg-convert -w 32 -h 32 public/favicon.svg -o public/favicon-32x32.png
rsvg-convert -w 48 -h 48 public/favicon.svg -o "$tmp/favicon-48.png"
magick public/favicon-16x16.png public/favicon-32x32.png "$tmp/favicon-48.png" public/favicon.ico

# App icons: full-bleed night ground, flower inside the maskable safe zone.
rsvg-convert -w 180 -h 180 scripts/brand/app-icon.svg -o public/apple-touch-icon.png
rsvg-convert -w 192 -h 192 scripts/brand/app-icon.svg -o public/pwa-192x192.png
rsvg-convert -w 512 -h 512 scripts/brand/app-icon.svg -o public/pwa-512x512.png
