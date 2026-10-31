import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createPushService } from "../deploy/server/push.mjs";

test("push service saves, delivers and removes a device reminder", async () => {
  const directory = await mkdtemp(join(tmpdir(), "kexu-push-"));
  const storePath = join(directory, "push.json");
  let now = 1_000;
  const sent = [];
  const delivery = {
    setVapidDetails: () => {},
    sendNotification: async (subscription, payload) => {
      sent.push({ subscription, payload: JSON.parse(payload) });
      return { statusCode: 201 };
    },
  };
  const service = createPushService({
    publicKey: "public",
    privateKey: "private",
    subject: "https://example.test/",
    storePath,
    delivery,
    clock: () => now,
    startTimer: false,
  });
  const subscription = {
    endpoint: "https://push.example.test/device/one",
    keys: { p256dh: "public-key", auth: "auth-key" },
  };
  const request = (method, body) =>
    new Request("https://example.test/push?action=subscribe", {
      method,
      headers: { "Content-Type": "application/json", Origin: "https://example.test" },
      body: JSON.stringify(body),
    });
  try {
    const config = await service.handle(
      new Request("https://example.test/push?action=config"),
    );
    assert.deepEqual(await config.json(), { publicKey: "public" });
    const subscribed = await service.handle(
      request("POST", {
        subscription,
        test: true,
        reminders: [
          {
            id: "course|one",
            at: 2_000,
            title: "20 分钟后上课",
            body: "示例课程 · 10:15 · A205",
            url: "/",
          },
        ],
      }),
    );
    assert.equal(subscribed.status, 200);
    assert.equal(sent[0].payload.title, "上课提醒已开启");
    now = 3_000;
    await service.runDue();
    assert.equal(sent[1].payload.title, "20 分钟后上课");
    const stored = JSON.parse(await readFile(storePath, "utf8"));
    assert.deepEqual(stored.devices[0].reminders, []);
    const removed = await service.handle(request("DELETE", { subscription }));
    assert.equal(removed.status, 200);
    const cleared = JSON.parse(await readFile(storePath, "utf8"));
    assert.deepEqual(cleared.devices, []);
  } finally {
    service.close();
    await rm(directory, { recursive: true, force: true });
  }
});
