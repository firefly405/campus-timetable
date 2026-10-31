import { createServer } from "node:http";
import school from "./school-api.cjs";
import { createPushService } from "./push.mjs";

const key = process.env.SCHOOL_SESSION_KEY ?? "";
if (!/^[a-z\d_-]{43}$/i.test(key) || Buffer.from(key, "base64url").length !== 32)
  throw new Error("SCHOOL_SESSION_KEY must be a 32-byte base64url secret");

const handlers = { GET: school.GET, POST: school.POST, DELETE: school.DELETE };
const push = createPushService({
  publicKey: process.env.VAPID_PUBLIC_KEY ?? "",
  privateKey: process.env.VAPID_PRIVATE_KEY ?? "",
  subject: process.env.VAPID_SUBJECT ?? "https://errand-sprint-recess.ngrok-free.dev/",
});
const port = Number(process.env.PORT ?? 8087);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("PORT must be between 1 and 65535");

createServer(async (incoming, outgoing) => {
  try {
    if (!incoming.url) {
      outgoing.writeHead(404).end();
      return;
    }
    const protocol = incoming.headers["x-forwarded-proto"] ?? "http";
    const host = incoming.headers.host ?? "localhost";
    const url = new URL(incoming.url, `${protocol}://${host}`);
    if (!["/school", "/push"].includes(url.pathname)) {
      outgoing.writeHead(404).end();
      return;
    }
    const handler = handlers[incoming.method];
    if (!handler) {
      outgoing.writeHead(405, { Allow: "GET, POST, DELETE" }).end();
      return;
    }
    const request = new Request(url, {
      method: incoming.method,
      headers: incoming.headers,
      ...(["POST", "DELETE"].includes(incoming.method)
        ? { body: incoming, duplex: "half" }
        : {}),
    });
    const response =
      url.pathname === "/push" ? await push.handle(request) : await handler(request);
    const headers = Object.fromEntries(response.headers);
    if (response.headers.has("set-cookie"))
      headers["set-cookie"] = response.headers.getSetCookie();
    outgoing.writeHead(response.status, headers);
    if (response.body) {
      for await (const chunk of response.body) outgoing.write(chunk);
    }
    outgoing.end();
  } catch (error) {
    console.error("School request failed", error);
    if (!outgoing.headersSent) outgoing.writeHead(502);
    outgoing.end();
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`School API listening on 127.0.0.1:${port}`);
});
