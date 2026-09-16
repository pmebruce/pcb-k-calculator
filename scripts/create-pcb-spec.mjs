// A precise, data-driven engineering figure. No uploaded photo pixels are used.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PCB_SPEC } from '../lib/pcb-spec.ts';

const require = createRequire(import.meta.url);
let sharp;
try { sharp = require('sharp'); }
catch { sharp = require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'sharp')); }

let y = 300;
const rows = PCB_SPEC.layers.map((layer) => {
  const height = layer.kind === 'copper' ? 76 : layer.kind === 'core' ? 120 : 100;
  const mid = y + height / 2;
  const fill = layer.kind === 'copper' ? 'url(#copper)' : layer.kind === 'core' ? 'url(#core)' : 'url(#prepreg)';
  const text = `<g data-material="${layer.material}" data-minimum-mil="${layer.minimumMil}">
    ${layer.label ? `<text x="111" y="${mid - 3}" class="layer" text-anchor="middle">${layer.label}</text><text x="111" y="${mid + 24}" class="position" text-anchor="middle">${layer.position}</text><path d="M179 ${mid} H205" stroke="#9da99b" stroke-width="2"/>` : ''}
    <rect x="218" y="${y}" width="372" height="${height}" fill="${fill}" stroke="#fafbf5" stroke-width="2"/>
    ${layer.kind === 'copper' ? '' : `<rect x="278" y="${mid - 28}" width="252" height="56" rx="10" fill="#fffefa" stroke="${layer.kind === 'core' ? '#a8bda7' : '#ccd8bf'}" stroke-width="1.5"/>`}
    <text x="404" y="${mid + 12}" class="material" text-anchor="middle" fill="${layer.kind === 'copper' ? '#4b301e' : '#264c39'}">${layer.material}</text>
    <text x="846" y="${mid + 12}" class="thickness" text-anchor="end">${layer.minimumMil}<tspan class="unit" dx="8">mil</tspan></text>
    <path d="M610 ${y + height} H846" stroke="#e5e8dd" stroke-width="1.5"/>
  </g>`;
  y += height;
  return text;
}).join('\n');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1260" viewBox="0 0 900 1260" role="img" aria-labelledby="title desc">
<title id="title">Four-layer PCB specification</title>
<desc id="desc">L1 copper foil minimum 3.8 mil; prepreg minimum 10 mil; L2 copper foil minimum 3.409 mil; core minimum 15 mil; L3 copper foil minimum 3.409 mil; prepreg minimum 10 mil; L4 copper foil minimum 3.8 mil. PWB total thickness 1.57 ± 0.15 mm, or 61.8 ± 5.9 mil. Layer values are minima. Schematic not to scale.</desc>
<defs>
  <linearGradient id="copper" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#e6b48b"/><stop offset="1" stop-color="#cc936c"/></linearGradient>
  <pattern id="prepreg" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="#e7eddb"/><path d="M-4 4L4-4M0 14L14 0M10 18L18 10" stroke="#c0ceb3" stroke-width="1.5"/></pattern>
  <pattern id="core" width="18" height="18" patternUnits="userSpaceOnUse"><rect width="18" height="18" fill="#b9cdb7"/><path d="M0 9H18M9 0V18" stroke="#96b192" stroke-width="1.2"/></pattern>
</defs>
<style>
 text { font-family: 'DejaVu Sans', Arial, sans-serif; }
 .layer { font-size: 38px; font-weight: 700; fill: #264c39; }
 .position { font-size: 23px; fill: #71816e; }
 .material { font-size: 36px; font-weight: 600; }
 .thickness { font-size: 42px; font-weight: 600; fill: #2c4232; font-variant-numeric: tabular-nums; }
 .unit { font-size: 27px; font-weight: 400; fill: #71816e; }
</style>
<rect width="900" height="1260" fill="#f3f3eb"/>
<rect x="24" y="24" width="852" height="1212" rx="28" fill="#fffefa" stroke="#dce2d4" stroke-width="2"/>
<text x="56" y="83" fill="#a5663a" font-size="26" font-weight="700" letter-spacing="5">PWB STACK-UP</text>
<rect x="600" y="51" width="244" height="46" rx="23" fill="#eaf0e1"/>
<text x="722" y="81" fill="#436740" font-size="21" font-weight="600" text-anchor="middle">4 COPPER LAYERS</text>
<text x="56" y="163" fill="#164c3a" font-size="59" font-weight="700" letter-spacing="-2">PCB SPECIFICATION</text>
<text x="58" y="207" fill="#78846f" font-size="26">Copper foil / Prepreg / Core</text>
<path d="M56 235H844" stroke="#dfe4d6" stroke-width="2"/>
<text x="64" y="275" fill="#78846f" font-size="25">LAYER</text>
<text x="404" y="275" fill="#78846f" font-size="25" text-anchor="middle">CONSTRUCTION</text>
<text x="846" y="275" fill="#78846f" font-size="25" text-anchor="end">MIN. THICKNESS</text>
${rows}
<rect x="218" y="300" width="372" height="624" rx="0" fill="none" stroke="#bdc9b2" stroke-width="2"/>
<rect x="56" y="980" width="788" height="178" rx="18" fill="#164c3a"/>
<text x="82" y="1020" fill="#bed1ac" font-size="24" letter-spacing="2">PWB TOTAL THICKNESS</text>
<text x="82" y="1083" fill="#fffef3" font-size="56" font-weight="700">${PCB_SPEC.totalMm} ± ${PCB_SPEC.toleranceMm}<tspan font-size="34" font-weight="400" dx="10">mm</tspan></text>
<text x="82" y="1129" fill="#d8e2cb" font-size="30">${PCB_SPEC.totalMil} ± ${PCB_SPEC.toleranceMil} mil</text>
<text x="56" y="1200" fill="#78846f" font-size="24">Minimum layer values · Schematic not to scale</text>
</svg>`;

await mkdir('public/examples', { recursive: true });
await writeFile('public/examples/pcb-stackup-v1.svg', svg);
await sharp(Buffer.from(svg)).png().toFile('public/examples/pcb-stackup-v1.png');
console.log('Four-layer PCB specification: exact SVG and PNG generated.');
