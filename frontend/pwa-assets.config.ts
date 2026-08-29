import { resolve } from 'node:path'
import { defineConfig, defaultPngOptions, type ResolvedAssetSize } from '@vite-pwa/assets-generator/config'

// Source of truth for the icon: the brand master in assets/ (repo root),
// never a hand-exported copy — see .claude/frontend/INSTRUCTIONS.md's brand
// assets convention. Regenerate with:
//   cd frontend && pnpm exec pwa-assets-generator
//
// The upstream CLI's built-in presets (`minimal`, `minimal-2023`, ...) both
// name files `pwa-<w>x<h>.png` / `maskable-icon-<w>x<h>.png` and write them
// next to the source image (assets/logo/) — wrong location (that dir is
// masters-only) and wrong names (SPEC-pwa-shell.md's manifest config expects
// exactly pwa-192.png / pwa-512.png / maskable-512.png). This config
// customizes `assetName` to emit those exact filenames straight into
// public/icons/, which is what the manifest in vite.config.ts references.
const outDir = resolve(__dirname, 'public/icons')

export default defineConfig({
  images: '../assets/logo/openrep-icon-1024.png',
  headLinkOptions: {
    // We already hand-maintain <link rel="icon">/apple-touch-icon in
    // index.html for the existing (non-PWA) favicon set; don't have this
    // tool print head links for icons it isn't generating anyway.
    preset: '2023',
  },
  manifestIconsEntry: false,
  preset: {
    transparent: {
      sizes: [192, 512],
      // Master already has generous built-in padding around the symbol;
      // the library's transparent default (0.05) is fine here.
      padding: defaultPngOptions.transparent.padding,
    },
    maskable: {
      sizes: [512],
      // Maskable safe zone is the inner ~80% circle. The library default
      // (0.3, i.e. content scaled to 70%) sits comfortably inside that with
      // this source image — verified visually after generation.
      padding: 0.2,
    },
    apple: {
      // Apple touch icon is already served from public/apple-touch-icon.png
      // via the existing favicon pipeline; don't generate a duplicate here.
      sizes: [],
    },
    assetName: (type, size: ResolvedAssetSize) => {
      const name = type === 'maskable' ? `maskable-${size.width}.png` : `pwa-${size.width}.png`
      return resolve(outDir, name)
    },
  },
})
