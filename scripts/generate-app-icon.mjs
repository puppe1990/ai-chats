#!/usr/bin/env node

import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const publicDir = path.join(rootDir, 'public')

// Lucide "messages-square" icon paths (MIT) — https://lucide.dev/icons/messages-square
const ICON_PATHS = [
  'M16 10a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 14.286V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z',
  'M20 9a2 2 0 0 1 2 2v10.286a.71.71 0 0 1-1.212.502l-2.202-2.202A2 2 0 0 0 17.172 19H10a2 2 0 0 1-2-2v-1',
]

const BRAND = {
  gradientStart: '#56c6be',
  gradientEnd: '#2f6a4a',
  icon: '#ffffff',
}

function buildSvg(size) {
  const inset = Math.round(size * 0.21)
  const iconBox = size - inset * 2
  const radius = Math.round(size * 0.22)

  const paths = ICON_PATHS.map((d) => `<path d="${d}"/>`).join('\n    ')

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${BRAND.gradientStart}"/>
      <stop offset="100%" stop-color="${BRAND.gradientEnd}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#bg)"/>
  <svg x="${inset}" y="${inset}" width="${iconBox}" height="${iconBox}" viewBox="0 0 24 24" fill="none" stroke="${BRAND.icon}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    ${paths}
  </svg>
</svg>
`
}

async function writePng(size) {
  const outputPath = path.join(publicDir, `logo${size}.png`)
  const svgPath = path.join(publicDir, 'app-icon.svg')
  const svg = buildSvg(size)

  writeFileSync(svgPath, svg)
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(outputPath)
  console.log(`Wrote ${outputPath}`)
}

for (const size of [192, 512]) {
  await writePng(size)
}
