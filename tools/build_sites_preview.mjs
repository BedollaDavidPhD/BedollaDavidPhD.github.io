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

const files = [
  "index.html",
  "404.html",
  "robots.txt",
  "sitemap.xml",
  "site.webmanifest",
];

const directories = ["assets", "documents", "public"];

for (const file of files) {
  await cp(join(root, file), join(client, file));
}

for (const directory of directories) {
  await cp(join(root, directory), join(client, directory), { recursive: true });
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
