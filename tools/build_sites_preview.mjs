import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, "dist");
const client = join(dist, "client");
const server = join(dist, "server");

await rm(dist, { recursive: true, force: true });
await mkdir(client, { recursive: true });
await mkdir(server, { recursive: true });

const siteFiles = [
  "index.html",
  "404.html",
  "robots.txt",
  "sitemap.xml",
  "site.webmanifest",
  "assets/css/styles.css",
  "assets/data/videos.json",
  "assets/js/main.js",
  "assets/images/dynamics-forge.svg",
  "assets/images/exoskeleton.svg",
  "assets/images/favicon.svg",
  "assets/images/init-robots-logo.png",
  "assets/images/mobile-manipulator.svg",
  "assets/images/profile.jpg",
  "assets/images/tooling.svg",
  "documents/David_Bedolla_CV.pdf",
  "public/og.png",
];

for (const file of siteFiles) {
  const destination = join(client, file);
  await mkdir(dirname(destination), { recursive: true });
  await cp(join(root, file), destination);
}

const worker = `const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname === "/" ? "/index.html" : url.pathname;
    const assetRequest = new Request(new URL(path, url), request);
    const assetResponse = await env.ASSETS.fetch(assetRequest);

    if (assetResponse.status !== 404) {
      return assetResponse;
    }

    const notFoundRequest = new Request(new URL("/404.html", url), request);
    const notFoundResponse = await env.ASSETS.fetch(notFoundRequest);
    return new Response(notFoundResponse.body, {
      status: 404,
      headers: notFoundResponse.headers,
    });
  },
};

export default worker;
`;

await writeFile(join(server, "index.js"), worker, "utf8");
console.log(dist);
