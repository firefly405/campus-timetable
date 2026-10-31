import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { installBrowser } from "../src/core/install.ts";

test("home-screen guidance recognizes mobile, iPad desktop mode and embedded browsers", () => {
  assert.deepEqual(
    installBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Safari/604.1", 5),
    { platform: "ios", embedded: false },
  );
  assert.equal(
    installBrowser(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Safari/605.1",
      5,
    ).platform,
    "ios",
  );
  assert.equal(
    installBrowser(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Safari/605.1",
      0,
    ).platform,
    "desktop",
  );
  assert.deepEqual(
    installBrowser("Mozilla/5.0 (Linux; Android 15) Chrome/130.0 Mobile"),
    { platform: "android", embedded: false },
  );
  assert.equal(
    installBrowser(
      "Mozilla/5.0 (Phone; OpenHarmony 5.0) AppleWebKit/537.36 ArkWeb/4.1 Mobile",
    ).platform,
    "harmony",
  );
  assert.equal(
    installBrowser(
      "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 HuaweiBrowser/15.0 Mobile",
    ).platform,
    "harmony",
  );
  assert.deepEqual(installBrowser("Mozilla/5.0 (iPhone) MicroMessenger/8.0"), {
    platform: "ios",
    embedded: true,
  });
  assert.equal(installBrowser("Mozilla/5.0 (Android) QQ/9.0").embedded, true);
  assert.equal(
    installBrowser("Mozilla/5.0 (Android) MQQBrowser/14.0").embedded,
    false,
  );
});

test("installed shortcuts open the homepage with shipped app icons", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../public/manifest.json", import.meta.url), "utf8"),
  );
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.display, "standalone");
  for (const size of ["192x192", "512x512"]) {
    const icon = manifest.icons.find(
      (item: { sizes: string }) => item.sizes === size,
    );
    assert.ok(icon);
    assert.ok(existsSync(new URL("../public" + icon.src, import.meta.url)));
  }
  assert.ok(
    existsSync(new URL("../public/apple-touch-icon.png", import.meta.url)),
  );
  const worker = readFileSync(
    new URL("../public/sw.js", import.meta.url),
    "utf8",
  );
  assert.match(worker, /addEventListener\("push"/);
  assert.match(worker, /addEventListener\("notificationclick"/);
  assert.match(worker, /skipWaiting/);
  assert.match(worker, /clients\.claim/);
  assert.match(worker, /postMessage\(\{ type: "kexu-reminder"/);
});
