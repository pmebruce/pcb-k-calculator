// Exact numerical tables rendered as vector figures; no source photo pixels.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PCB_COPPER_TABLES } from '../lib/pcb-copper-tables.ts';

const require = createRequire(import.meta.url);
let sharp;
try { sharp = require('sharp'); }
catch { sharp = require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'sharp')); }
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
await mkdir('public/examples', { recursive: true });

for (const table of PCB_COPPER_TABLES) {
  const outer = table.columns.length > 1;
  const top = 270, headerHeight = outer ? 150 : 110, rowHeight = 88;
  const tableHeight = headerHeight + table.rows.length * rowHeight;
  const bottom = top + tableHeight;
  const height = bottom + 166;
  const centers = outer ? [397, 695] : [546];
  const rows = table.rows.map((row, index) => {
    const y = top + headerHeight + index * rowHeight;
    return `<g data-weight-oz="${row.oz}">
      <rect x="56" y="${y}" width="788" height="${rowHeight}" fill="${index % 2 ? '#f0f3e9' : '#fffefa'}"/>
      <path d="M56 ${y + rowHeight}H844" stroke="#dce3d3" stroke-width="1.5"/>
      <text x="152" y="${y + 54}" class="weight" text-anchor="middle">${row.oz}</text>
      ${row.thicknesses.map((thickness, column) => `<g data-um="${thickness.um}" data-mil="${thickness.mil}">
        <text x="${centers[column]}" y="${y + 39}" class="value" text-anchor="middle">${thickness.um}<tspan dx="7" class="unit">µm</tspan></text>
        <text x="${centers[column]}" y="${y + 70}" class="mil" text-anchor="middle">${thickness.mil} mil</text>
      </g>`).join('')}
    </g>`;
  }).join('\n');
  const columnHeader = outer ? `
    <text x="546" y="${top + 34}" class="header" text-anchor="middle">FINISHED THICKNESS · MINIMUM</text>
    <path d="M248 ${top + 52}H844" stroke="#608169" stroke-width="1.5"/>
    ${table.columns.map((column, index) => `<text x="${centers[index]}" y="${top + 87}" class="header-muted" text-anchor="middle">HOLE COPPER</text><text x="${centers[index]}" y="${top + 128}" class="plating" text-anchor="middle">${escape(column.platingMil)}<tspan dx="7" font-size="22" font-weight="400">mil</tspan></text>`).join('')}
    <path d="M546 ${top + 52}V${bottom}" stroke="#dce3d3" stroke-opacity=".45" stroke-width="1.5"/>`
    : `<text x="546" y="${top + 44}" class="header" text-anchor="middle">FINISHED CONDUCTOR THICKNESS</text><text x="546" y="${top + 81}" class="header-muted" text-anchor="middle">MINIMUM</text>`;
  const description = table.rows.map(row => `${row.oz} oz: ${row.thicknesses.map(thickness => `${thickness.um} µm (${thickness.mil} mil)`).join('; ')}`).join('. ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="${height}" viewBox="0 0 900 ${height}" role="img" aria-labelledby="title desc">
<title id="title">Table ${table.number} — ${escape(table.title)}</title>
<desc id="desc">${escape(table.englishDescription)}. Minimum thickness. ${description}. Values preserved as printed in the supplied table.</desc>
<defs><clipPath id="table"><rect x="56" y="${top}" width="788" height="${tableHeight}" rx="14"/></clipPath></defs>
<style>
text { font-family: 'DejaVu Sans', Arial, sans-serif; }
.header { fill:#fffef4; font-size:23px; font-weight:600; }
.header-muted { fill:#c6d9b6; font-size:22px; }
.plating { fill:#fffef4; font-size:31px; font-weight:600; }
.weight { fill:#415d3c; font-size:35px; font-weight:600; }
.value { fill:#243f2e; font-size:35px; font-weight:700; font-variant-numeric:tabular-nums; }
.unit { fill:#687c5e; font-size:23px; font-weight:400; }
.mil { fill:#72806a; font-size:24px; }
</style>
<rect width="900" height="${height}" fill="#f3f3eb"/>
<rect x="24" y="24" width="852" height="${height - 48}" rx="28" fill="#fffefa" stroke="#dce2d4" stroke-width="2"/>
<text x="56" y="81" fill="#a5663a" font-size="25" font-weight="700" letter-spacing="4">PCB PROCUREMENT</text>
<rect x="672" y="51" width="172" height="46" rx="23" fill="#eaf0e1"/>
<text x="758" y="81" fill="#436740" font-size="23" font-weight="700" text-anchor="middle">TABLE ${table.number}</text>
<text x="56" y="157" fill="#164c3a" font-size="${table.number === 5 ? 52 : 60}" font-weight="700" letter-spacing="-1.5">${table.englishTitle}</text>
<text x="58" y="200" fill="#687961" font-size="26">Finished conductor thickness · minimum</text>
<text x="58" y="238" fill="#87907f" font-size="23">§ ${table.clause} · ${escape(table.englishDescription)}</text>
<g clip-path="url(#table)">
<rect x="56" y="${top}" width="788" height="${headerHeight}" fill="#164c3a"/>
${rows}
<text x="152" y="${top + (outer ? 55 : 44)}" class="header" text-anchor="middle">BASE COPPER</text>
<text x="152" y="${top + (outer ? 90 : 77)}" class="header-muted" text-anchor="middle">WEIGHT · oz</text>
${columnHeader}
<path d="M248 ${top}V${bottom}" stroke="#c6d3be" stroke-opacity=".7" stroke-width="1.5"/>
</g>
<rect x="56" y="${top}" width="788" height="${tableHeight}" rx="14" fill="none" stroke="#d4decc" stroke-width="2"/>
<text x="58" y="${bottom + 57}" fill="#49633f" font-size="27" font-weight="600">1 mil = 0.001 in</text>
<text x="58" y="${bottom + 101}" fill="#7d8974" font-size="23">µm and mil values preserved as printed.</text>
</svg>`;
  const filename = `public/examples/pcb-table-${table.number}-v1`;
  await writeFile(`${filename}.svg`, svg);
  await sharp(Buffer.from(svg)).png().toFile(`${filename}.png`);
}
console.log('Tables 3, 4 and 5 redrawn as exact SVG and PNG figures.');
