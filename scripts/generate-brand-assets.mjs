#!/usr/bin/env node
/**
 * Generates Yatra Travel brand assets (SVG + PNG) and placeholder illustrations.
 *   node scripts/generate-brand-assets.mjs
 * Outputs:
 *   public/brand/yatra-travel-mark.svg, yatra-travel-logo.svg, yatra-travel-logo.png (1024w),
 *   yatra-travel-mark-512.png, og-default.png (1200x630)
 *   src/app/icon.svg (favicon), src/app/apple-icon.png (180x180)
 *   public/images/placeholders/*.svg (illustrations until real photos are uploaded)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = (p, data) => {
  mkdirSync(dirname(join(root, p)), { recursive: true });
  writeFileSync(join(root, p), data);
  console.log("wrote", p);
};

const GREEN = "#0f3d2e";
const GOLD = "#d9a83a";
const GOLD_DARK = "#c18e26";
const GOLD_LIGHT = "#f2d98f";
const IVORY = "#faf6ec";

const markInner = `
  <circle cx="32" cy="32" r="31" fill="${GREEN}"/>
  <circle cx="32" cy="32" r="27.5" fill="none" stroke="${GOLD}" stroke-width="1.5"/>
  <path d="M32 9.5c1.6 0 2.6 1.2 2.6 2.6 0 1-.6 1.7-1.3 2.1h1.2v1.6h-5v-1.6h1.2c-.7-.4-1.3-1.1-1.3-2.1 0-1.4 1-2.6 2.6-2.6z" fill="${GOLD_LIGHT}"/>
  <path d="M27.5 17h9l1.2 5h-11.4z" fill="${GOLD}"/>
  <path d="M25.5 22h13l1.4 6h-15.8z" fill="${GOLD_DARK}"/>
  <path d="M23.5 28h17l1.6 7h-20.2z" fill="${GOLD}"/>
  <path d="M21.5 35h21l1.8 8h-24.6z" fill="${GOLD_DARK}"/>
  <path d="M29.6 43v-3.4a2.4 2.4 0 0 1 4.8 0V43z" fill="${GREEN}"/>
  <path d="M12 52c6-5.5 13-8.3 20-8.3S46 46.5 52 52" fill="none" stroke="${GOLD_LIGHT}" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M32 46.5v2.2M32 51v2" stroke="${GREEN}" stroke-width="1.2" stroke-linecap="round"/>`;

const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Yatra Travel">${markInner}</svg>\n`;

const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 80" role="img" aria-label="Yatra Travel — Your Journey, Our Devotion.">
  <g transform="translate(8 8)">${markInner}</g>
  <text x="84" y="44" font-family="Playfair Display, Georgia, serif" font-size="32" font-weight="600" fill="${GREEN}">Yatra <tspan fill="${GOLD_DARK}">Travel</tspan></text>
  <text x="85" y="64" font-family="Inter, Arial, sans-serif" font-size="12.5" letter-spacing="0.6" fill="#5f5a50">Your Journey, Our Devotion.</text>
</svg>\n`;

out("public/brand/yatra-travel-mark.svg", markSvg);
out("public/brand/yatra-travel-logo.svg", logoSvg);
out("src/app/icon.svg", markSvg);

await sharp(Buffer.from(logoSvg)).resize({ width: 1024 }).flatten({ background: IVORY }).png().toFile(join(root, "public/brand/yatra-travel-logo.png"));
await sharp(Buffer.from(markSvg)).resize(512, 512).png().toFile(join(root, "public/brand/yatra-travel-mark-512.png"));
await sharp(Buffer.from(markSvg)).resize(180, 180).flatten({ background: GREEN }).png().toFile(join(root, "src/app/apple-icon.png"));

const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${GREEN}"/>
  <g opacity="0.12" fill="${GOLD}">${Array.from({ length: 40 }, (_, i) => `<circle cx="${i * 32 + 8}" cy="610" r="5"/>`).join("")}</g>
  <g transform="translate(90 165) scale(4.6)">${markInner}</g>
  <text x="440" y="300" font-family="Playfair Display, Georgia, serif" font-size="88" font-weight="600" fill="${IVORY}">Yatra Travel</text>
  <text x="444" y="370" font-family="Inter, Arial, sans-serif" font-size="34" fill="${GOLD_LIGHT}">Your Journey, Our Devotion.</text>
  <text x="444" y="440" font-family="Inter, Arial, sans-serif" font-size="26" fill="#d3e8de">Tirumala transfers · Temple tours · Cabs in Tirupati</text>
</svg>`;
await sharp(Buffer.from(ogSvg)).png().toFile(join(root, "public/brand/og-default.png"));
console.log("wrote PNG assets");

// ---------------------------------------------------------------------------
// Placeholder illustrations (replace with licensed photographs before launch)
// ---------------------------------------------------------------------------
const sky = (a, b) => `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="800" height="500" fill="url(#s)"/>`;
const hills = (color, y = 330) => `<path d="M0 ${y} Q 120 ${y - 90} 240 ${y - 20} T 480 ${y - 40} T 800 ${y - 10} V500 H0z" fill="${color}"/>`;
const gopuram = (x, y, s = 1, fill = GOLD_DARK) => `<g transform="translate(${x} ${y}) scale(${s})">
  <rect x="-70" y="0" width="140" height="22" fill="${fill}"/><rect x="-60" y="-26" width="120" height="26" fill="${GOLD}"/>
  <rect x="-50" y="-50" width="100" height="24" fill="${fill}"/><rect x="-40" y="-72" width="80" height="22" fill="${GOLD}"/>
  <rect x="-30" y="-92" width="60" height="20" fill="${fill}"/><path d="M-30 -92 Q0 -125 30 -92z" fill="${GOLD}"/>
  <circle cx="0" cy="-128" r="6" fill="${GOLD_LIGHT}"/><path d="M-12 22v-14a12 12 0 0 1 24 0v14z" fill="${GREEN}"/></g>`;
const water = (y) => `<rect x="0" y="${y}" width="800" height="${500 - y}" fill="#4f8fa8"/><path d="M0 ${y + 20} q40 -8 80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0" stroke="#bfe0ea" stroke-width="3" fill="none"/>`;
const sun = `<circle cx="640" cy="110" r="46" fill="${GOLD_LIGHT}" opacity="0.9"/>`;
const tree = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-5" y="0" width="10" height="40" fill="#5b3b1d"/><circle cx="0" cy="-10" r="30" fill="#2a6b52"/></g>`;
const palm = (x, y) => `<g transform="translate(${x} ${y})"><path d="M0 0 Q 6 -60 0 -110" stroke="#6b4a26" stroke-width="8" fill="none"/><g fill="#2a6b52"><path d="M0 -110 q-50 -10 -70 20 q35 -15 70 -20z"/><path d="M0 -110 q50 -10 70 20 q-35 -15 -70 -20z"/><path d="M0 -110 q-20 -40 -50 -45 q25 15 50 45z"/><path d="M0 -110 q20 -40 50 -45 q-25 15 -50 45z"/></g></g>`;
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice">${body}</svg>\n`;

const placeholders = {
  "temple-hills": svg(`${sky("#f7e3b5", "#fbf3df")}${sun}${hills("#7fb39b", 300)}${hills("#2a6b52", 380)}${gopuram(400, 330, 1.1)}`),
  "temple-pond": svg(`${sky("#f3dcae", "#fbf3df")}${sun}${hills("#7fb39b", 320)}${gopuram(400, 300, 0.9)}${water(340)}`),
  "temple-river": svg(`${sky("#efd7a5", "#fbf3df")}${hills("#7fb39b", 300)}${gopuram(300, 320, 1)}${water(360)}${tree(620, 300, 1)}`),
  "temple-village": svg(`${sky("#f6e1b0", "#fbf3df")}${sun}${hills("#9cc5ad", 340)}${gopuram(400, 340, 0.95)}${palm(150, 380)}${palm(660, 390)}`),
  "temple-town": svg(`${sky("#f1d9a6", "#fbf3df")}<rect x="0" y="360" width="800" height="140" fill="#c9b994"/>${gopuram(400, 360, 1.5)}<rect x="60" y="300" width="90" height="60" fill="#e8dcc0"/><rect x="650" y="290" width="100" height="70" fill="#e8dcc0"/>`),
  waterfall: svg(`${sky("#cfe6dc", "#f4efe0")}${hills("#2a6b52", 260)}<path d="M360 160 h80 v340 h-80z" fill="#bfe0ea"/><path d="M370 160 v340 M400 160 v340 M430 160 v340" stroke="#ffffff" stroke-width="4" opacity="0.7"/>${gopuram(620, 380, 0.6)}${water(430)}`),
  forest: svg(`${sky("#d8eadf", "#f4efe0")}${hills("#2a6b52", 280)}<path d="M390 120 h40 v330 h-40z" fill="#bfe0ea"/>${tree(150, 380, 1.4)}${tree(260, 400, 1.1)}${tree(560, 390, 1.3)}${tree(680, 400, 1.2)}${water(440)}`),
  fort: svg(`${sky("#f2dcae", "#fbf3df")}${sun}${hills("#9a8a63", 330)}<g fill="#b7a274"><rect x="250" y="210" width="300" height="130"/><rect x="230" y="180" width="60" height="160"/><rect x="510" y="180" width="60" height="160"/></g><g fill="${GREEN}"><path d="M380 340v-50a20 20 0 0 1 40 0v50z"/></g>${hills("#2a6b52", 420)}`),
  park: svg(`${sky("#d9ecd9", "#f4efe0")}${hills("#7fb39b", 330)}${tree(120, 380, 1.3)}${tree(680, 380, 1.4)}<rect x="300" y="250" width="200" height="20" fill="${GOLD_DARK}"/><rect x="310" y="270" width="20" height="110" fill="${GOLD_DARK}"/><rect x="470" y="270" width="20" height="110" fill="${GOLD_DARK}"/>${hills("#2a6b52", 430)}`),
  "temple-gold": svg(`${sky("#f5e2b2", "#fdf8ea")}<circle cx="400" cy="250" r="190" fill="${GOLD_LIGHT}" opacity="0.5"/>${gopuram(400, 360, 1.4, "#e1b545")}${hills("#2a6b52", 430)}`),
};
for (const [name, data] of Object.entries(placeholders)) out(`public/images/placeholders/${name}.svg`, data);
