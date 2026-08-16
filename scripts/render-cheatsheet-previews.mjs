#!/usr/bin/env node
/**
 * Render shipped GLBs to `.cursor/cheatsheets/img/{stem}.png` (cream 3/4).
 *
 *   node scripts/render-cheatsheet-previews.mjs
 */
import { createReadStream, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import http from "node:http";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { CAR_PREVIEW_YAW, GARAGE_PREVIEW_YAW, stemForPublicRel } from "./lib/cheatsheet-preview-jobs.mjs";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const imgDir = join(rootDir, ".cursor/cheatsheets/img");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".glb": "model/gltf-binary",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

function collectJobs() {
  const out = [];
  const add = (rel, yaw = 0) => {
    if (!existsSync(join(rootDir, rel))) return;
    if (rel.includes(".source.")) return;
    out.push({
      stem: stemForPublicRel(rel),
      url: "/" + rel.replace(/^public\//, ""),
      yaw,
    });
  };
  for (const id of Object.keys(CAR_PREVIEW_YAW)) {
    add(`public/models/cars/${id}.glb`, CAR_PREVIEW_YAW[id]);
  }
  const listGlb = (dir) =>
    existsSync(dir) ? readdirSync(dir).filter((n) => n.endsWith(".glb") && !n.includes(".source.")) : [];
  for (const f of listGlb(join(rootDir, "public/models/parts"))) {
    add(`public/models/parts/${f}`, 0);
  }
  for (const f of listGlb(join(rootDir, "public/models/garage"))) {
    add(`public/models/garage/${f}`, GARAGE_PREVIEW_YAW);
  }
  for (const f of listGlb(join(rootDir, "public/models/track"))) {
    add(`public/models/track/${f}`, 0);
  }
  for (const f of listGlb(join(rootDir, "public/models/props"))) {
    add(`public/models/props/${f}`, 0);
  }
  add("public/models/stickers/flames.glb", 0);
  return out;
}

function startServer() {
  const server = http.createServer((req, res) => {
    const raw = decodeURIComponent((req.url || "/").split("?")[0]);
    let rel = raw === "/" ? "/scripts/lib/glb-preview.html" : raw;
    if (rel.startsWith("/models/")) rel = `/public${rel}`;
    const abs = join(rootDir, rel.replace(/^\/+/, ""));
    if (!abs.startsWith(rootDir) || !existsSync(abs) || statSync(abs).isDirectory()) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[extname(abs)] || "application/octet-stream" });
    createReadStream(abs).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, port: server.address().port });
    });
  });
}

async function main() {
  mkdirSync(imgDir, { recursive: true });
  const jobs = collectJobs();
  const { server, port } = await startServer();
  const browser = await chromium.launch({
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
  });
  const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
  let failed = 0;
  try {
    for (const job of jobs) {
      const href = `http://127.0.0.1:${port}/scripts/lib/glb-preview.html?url=${encodeURIComponent(job.url)}&yaw=${job.yaw}&w=640&h=400`;
      await page.goto(href, { waitUntil: "networkidle", timeout: 30_000 });
      await page.waitForFunction(() => window.__previewReady === true, null, { timeout: 20_000 });
      const err = await page.evaluate(() => window.__previewError || "");
      if (err) {
        console.warn("skip", job.stem, err);
        failed += 1;
        continue;
      }
      const out = join(imgDir, `${job.stem}.png`);
      await page.screenshot({ path: out, type: "png" });
      process.stdout.write(`${job.stem} `);
    }
    console.log(`\nwrote ${jobs.length - failed}/${jobs.length} previews → .cursor/cheatsheets/img/`);
  } finally {
    await browser.close();
    server.close();
  }
  if (failed) process.exitCode = 1;
}

await main();
