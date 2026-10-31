import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = join(root, "server-dist");
const server = join(root, "dist", "server");

rmSync(output, { recursive: true, force: true });
cpSync(join(root, "dist", "client"), join(output, "public"), { recursive: true });
for (const name of readdirSync(server)) {
  if (name.endsWith(".html"))
    cpSync(join(server, name), join(output, "public", name));
}
mkdirSync(join(output, "app"));
cpSync(
  join(server, "_expo", "functions", "school+api.js"),
  join(output, "app", "school-api.cjs"),
);
cpSync(join(root, "deploy", "server", "school.mjs"), join(output, "app", "school.mjs"));
cpSync(join(root, "deploy", "server", "push.mjs"), join(output, "app", "push.mjs"));
cpSync(
  join(root, "deploy", "server", "generate-vapid.mjs"),
  join(output, "app", "generate-vapid.mjs"),
);
writeFileSync(
  join(output, "app", "package.json"),
  JSON.stringify(
    { private: true, type: "module", dependencies: { "web-push": "3.6.7" } },
    null,
    2,
  ) + "\n",
);
cpSync(join(root, "deploy", "server", "nginx.conf"), join(output, "nginx.conf"));
cpSync(join(root, "deploy", "server", "kexu.service"), join(output, "kexu.service"));
cpSync(join(root, "deploy", "server", "kexu-tunnel.service"), join(output, "kexu-tunnel.service"));
cpSync(join(root, "deploy", "server", "ngrok.yml"), join(output, "ngrok.yml"));
cpSync(join(root, "deploy", "server", "kexu-ngrok.service"), join(output, "kexu-ngrok.service"));
