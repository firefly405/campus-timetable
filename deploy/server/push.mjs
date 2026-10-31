import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import webpush from "web-push";

const MAX_BODY = 64 * 1024;
const MAX_DEVICES = 100;
const MAX_REMINDERS = 50;

function response(status, body) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function validSubscription(value) {
  if (!value || typeof value !== "object") return false;
  try {
    const endpoint = new URL(value.endpoint);
    return (
      endpoint.protocol === "https:" &&
      value.endpoint.length <= 2048 &&
      typeof value.keys?.p256dh === "string" &&
      value.keys.p256dh.length <= 256 &&
      typeof value.keys?.auth === "string" &&
      value.keys.auth.length <= 128
    );
  } catch {
    return false;
  }
}

function validReminder(value, now) {
  return (
    value &&
    typeof value.id === "string" &&
    value.id.length <= 500 &&
    Number.isFinite(value.at) &&
    value.at > now - 5 * 60_000 &&
    value.at < now + 183 * 86_400_000 &&
    typeof value.title === "string" &&
    value.title.length > 0 &&
    value.title.length <= 80 &&
    typeof value.body === "string" &&
    value.body.length > 0 &&
    value.body.length <= 300 &&
    typeof value.url === "string" &&
    value.url.startsWith("/") &&
    !value.url.startsWith("//")
  );
}

async function readStore(path) {
  try {
    const value = JSON.parse(await readFile(path, "utf8"));
    return Array.isArray(value.devices) ? value.devices : [];
  } catch (error) {
    if (error?.code !== "ENOENT") console.error("Push store could not be read", error);
    return [];
  }
}

async function saveStore(path, devices) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = path + ".next";
  await writeFile(temporary, JSON.stringify({ version: 1, devices }), {
    mode: 0o600,
  });
  await rename(temporary, path);
}

export function createPushService({
  publicKey,
  privateKey,
  subject,
  storePath = "/var/lib/kexu/push.json",
  delivery = webpush,
  clock = () => Date.now(),
  startTimer = true,
}) {
  if (!publicKey || !privateKey) throw new Error("VAPID keys are required");
  delivery.setVapidDetails(subject, publicKey, privateKey);
  let devicesPromise = readStore(storePath);
  let mutation = Promise.resolve();

  function update(operation) {
    const result = mutation.catch(() => {}).then(async () => {
      const devices = await devicesPromise;
      if ((await operation(devices)) !== false) await saveStore(storePath, devices);
    });
    mutation = result;
    return result;
  }

  async function send(subscription, payload, options = {}) {
    return delivery.sendNotification(subscription, JSON.stringify(payload), {
      TTL: 3600,
      urgency: "high",
      ...options,
    });
  }

  async function handle(request) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.searchParams.get("action") === "config")
      return response(200, { publicKey });
    if (!["POST", "DELETE"].includes(request.method))
      return response(405, { error: "不支持的提醒操作" });
    if (request.headers.get("origin") !== url.origin)
      return response(403, { error: "提醒请求来源无效" });
    if (Number(request.headers.get("content-length") || 0) > MAX_BODY)
      return response(413, { error: "提醒数据过大" });
    const text = await request.text();
    if (Buffer.byteLength(text) > MAX_BODY)
      return response(413, { error: "提醒数据过大" });
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return response(400, { error: "提醒数据格式无效" });
    }
    if (!validSubscription(body.subscription))
      return response(400, { error: "推送订阅无效" });

    if (request.method === "DELETE") {
      await update((devices) => {
        const index = devices.findIndex(
          (item) => item.subscription.endpoint === body.subscription.endpoint,
        );
        if (index >= 0) devices.splice(index, 1);
      });
      return response(200, { ok: true });
    }

    const now = clock();
    if (
      !Array.isArray(body.reminders) ||
      body.reminders.length > MAX_REMINDERS ||
      !body.reminders.every((item) => validReminder(item, now))
    )
      return response(400, { error: "课程提醒计划无效" });
    let sendTest = false;
    await update((devices) => {
      let device = devices.find(
        (item) => item.subscription.endpoint === body.subscription.endpoint,
      );
      if (!device) {
        if (devices.length >= MAX_DEVICES)
          devices.sort((a, b) => a.updatedAt - b.updatedAt).shift();
        device = { subscription: body.subscription, reminders: [], updatedAt: now };
        devices.push(device);
        sendTest = body.test === true;
      }
      device.subscription = body.subscription;
      device.reminders = [
        ...new Map(body.reminders.map((item) => [item.id, { ...item, attempts: 0 }])).values(),
      ].sort((a, b) => a.at - b.at);
      device.updatedAt = now;
    });
    if (sendTest)
      await send(
        body.subscription,
        {
          title: "上课提醒已开启",
          body: "今后将在上课前 20 分钟提醒你。",
          url: "/settings",
          tag: "kexu-reminder-test",
        },
        { TTL: 60 },
      );
    return response(200, { ok: true, reminders: body.reminders.length });
  }

  async function runDue() {
    const now = clock();
    await update(async (devices) => {
      if (!devices.some((device) => device.reminders.some((item) => item.at <= now)))
        return false;
      for (let deviceIndex = devices.length - 1; deviceIndex >= 0; deviceIndex--) {
        const device = devices[deviceIndex];
        const pending = [];
        let expired = false;
        for (const reminder of device.reminders) {
          if (reminder.at > now) {
            pending.push(reminder);
            continue;
          }
          try {
            await send(device.subscription, {
              title: reminder.title,
              body: reminder.body,
              url: reminder.url,
              tag: reminder.id,
            });
          } catch (error) {
            if ([404, 410].includes(error?.statusCode)) {
              expired = true;
              break;
            }
            if ((reminder.attempts || 0) < 2)
              pending.push({
                ...reminder,
                attempts: (reminder.attempts || 0) + 1,
                at: now + 60_000,
              });
            else console.error("Push reminder failed", error);
          }
        }
        if (expired) devices.splice(deviceIndex, 1);
        else device.reminders = pending;
      }
      return true;
    });
  }

  const timer = startTimer
    ? setInterval(() => runDue().catch((error) => console.error("Push queue failed", error)), 15_000)
    : null;
  timer?.unref();
  return {
    handle,
    runDue,
    close: () => timer && clearInterval(timer),
  };
}
