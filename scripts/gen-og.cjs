#!/usr/bin/env node
/**
 * og.png — the 1200×630 social-share image (iMessage/Twitter/Facebook link preview).
 * Brand-only: logo + GILLYLAB wordmark + tagline. No hard stats, so it never goes
 * stale. Regenerate with `node scripts/gen-og.cjs`.
 */
const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require("canvas");

const ROOT = path.join(__dirname, "..");
const W = 1200, H = 630;
const FONT = "sans-serif";

(async () => {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Dark canvas + a soft green glow from the top, matching the site.
  ctx.fillStyle = "#0a0a0b";
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, -60, 40, W / 2, -60, 760);
  glow.addColorStop(0, "rgba(0,230,104,0.18)");
  glow.addColorStop(1, "rgba(10,10,11,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  // Thin accent rule along the bottom.
  ctx.fillStyle = "#00e668";
  ctx.fillRect(0, H - 8, W, 8);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Eyebrow badge.
  ctx.font = "700 26px " + FONT;
  ctx.fillStyle = "#00e668";
  ctx.fillText("EVERY STAT  ·  EVERY MATCHUP  ·  EVERY EDGE", W / 2, 172);

  // Logo mark + wordmark, centered as a group.
  const logo = await loadImage(path.join(ROOT, "gl-logo.png"));
  const lh = 96, lw = (logo.width / logo.height) * lh, gap = 22;
  ctx.font = "800 92px " + FONT;
  const gilly = "GILLY", lab = "LAB";
  const gw = ctx.measureText(gilly).width, lw2 = ctx.measureText(lab).width;
  const totalW = lw + gap + gw + lw2;
  const startX = (W - totalW) / 2;
  const cy = 322;
  ctx.drawImage(logo, startX, cy - lh / 2, lw, lh);
  ctx.textAlign = "left";
  let x = startX + lw + gap;
  ctx.fillStyle = "#f4f5f7";
  ctx.fillText(gilly, x, cy);
  x += gw;
  ctx.fillStyle = "#00e668";
  ctx.fillText(lab, x, cy);

  // Tagline + URL.
  ctx.textAlign = "center";
  ctx.font = "500 42px " + FONT;
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.fillText("The Ultimate UFC Analytics Database", W / 2, 438);
  ctx.font = "600 27px " + FONT;
  ctx.fillStyle = "rgba(255,255,255,0.42)";
  ctx.fillText("gillylab.com", W / 2, 512);

  const buf = canvas.toBuffer("image/png");
  fs.writeFileSync(path.join(ROOT, "og.png"), buf);
  console.log("og.png written:", buf.length, "bytes (" + W + "x" + H + ")");
})();
