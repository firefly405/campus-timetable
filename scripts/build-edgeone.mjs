import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = join(root, "edgeone-dist");
const server = join(root, "dist", "server");

rmSync(output, { recursive: true, force: true });
cpSync(join(root, "dist", "client"), output, { recursive: true });
for (const name of readdirSync(server)) {
  if (name.endsWith(".html")) cpSync(join(server, name), join(output, name));
}

const functions = join(output, "cloud-functions");
mkdirSync(functions);
cpSync(
  join(server, "_expo", "functions", "school+api.js"),
  join(functions, "school-api.js"),
);
cpSync(join(root, "deploy", "edgeone", "school.js"), join(functions, "school.js"));
writeFileSync(join(output, "package.json"), '{"private":true}\n');
