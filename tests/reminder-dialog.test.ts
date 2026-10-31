import test from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import { showReminderDialog } from "../src/core/reminder-dialog.ts";

test("foreground reminders render, replace and close their own visible dialog", () => {
  const { document } = parseHTML("<html><body></body></html>");
  showReminderDialog(document as unknown as Document, "上课提醒已开启", "页面保持打开");

  const first = document.getElementById("kexu-reminder-dialog");
  assert.ok(first);
  assert.equal(first.querySelector('[role="alertdialog"]')?.textContent, "上课提醒已开启页面保持打开知道了");

  showReminderDialog(document as unknown as Document, "20 分钟后上课", "高等数学 · 08:00");
  assert.equal(document.querySelectorAll("#kexu-reminder-dialog").length, 1);
  assert.match(document.body.textContent, /20 分钟后上课.*高等数学/);

  document.querySelector<HTMLButtonElement>("#kexu-reminder-dialog button")?.click();
  assert.equal(document.getElementById("kexu-reminder-dialog"), null);
});
