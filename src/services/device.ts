import { reminderPlan, Snapshot } from "../core/model";
import { installBrowser } from "../core/install";
import { showReminderDialog } from "../core/reminder-dialog";
import { Platform } from "react-native";
import { WEB_GATEWAY_HEADERS } from "./web-gateway";
export type ReminderMode = "system" | "foreground";
type PlannedReminder = ReturnType<typeof reminderPlan>[number];
let requestedMode: ReminderMode | null = null;
export const canClearSession = () => Platform.OS === "web";
export const clearSchoolSession = async () => {
  if (Platform.OS !== "web") return;
  const response = await fetch("/school", {
    method: "DELETE",
    credentials: "same-origin",
    headers: WEB_GATEWAY_HEADERS,
  });
  if (!response.ok) throw new Error("学校网页登录状态清理失败");
};
function installed() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
function pushSupported() {
  if (typeof window === "undefined") return false;
  const browser = installBrowser(navigator.userAgent, navigator.maxTouchPoints);
  return (
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    (browser.platform !== "ios" || installed())
  );
}
export function webReminderMode(): ReminderMode {
  return (
    requestedMode ??
    (pushSupported() && Notification.permission === "granted"
      ? "system"
      : "foreground")
  );
}
function applicationServerKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
async function registration() {
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}
async function errorMessage(response: Response) {
  const result = await response.json().catch(() => null);
  return result?.error || "提醒服务暂时不可用";
}
let foregroundPlan: PlannedReminder[] = [];
let foregroundMinutes = 20;
let foregroundTimer: ReturnType<typeof setInterval> | null = null;
let foregroundTestPending = false;
let systemTestPending = false;
let foregroundFired = new Set<string>();
let audioContext: AudioContext | null = null;

if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    const data = event.data;
    if (
      data?.type === "kexu-reminder" &&
      typeof data.title === "string" &&
      typeof data.body === "string"
    )
      showReminderDialog(document, data.title, data.body);
  });
}

function prepareForegroundFeedback() {
  const Audio = window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Audio) return;
  try {
    audioContext ??= new Audio();
    void audioContext.resume().catch(() => {});
  } catch {}
}
function beep() {
  if (!audioContext || audioContext.state !== "running") return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.frequency.value = 880;
  gain.gain.setValueAtTime(0.12, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.45);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.45);
}
function showForeground(title: string, body: string) {
  beep();
  navigator.vibrate?.([180, 100, 180]);
  showReminderDialog(document, title, body);
}
function checkForegroundReminders() {
  const now = Date.now();
  for (const item of foregroundPlan) {
    const id = `${item.lesson.id}|${item.at}`;
    if (
      foregroundFired.has(id) ||
      item.at > now ||
      now >= item.at + foregroundMinutes * 60_000
    )
      continue;
    foregroundFired.add(id);
    showForeground(
      `${foregroundMinutes} 分钟后上课`,
      `${item.lesson.course.name} · ${item.lesson.start} · ${item.lesson.room || "地点待定"}`,
    );
  }
}
function startForegroundReminders(snapshot: Snapshot, minutes: number) {
  foregroundPlan = reminderPlan(snapshot, minutes);
  foregroundMinutes = minutes;
  const currentIds = new Set(
    foregroundPlan.map((item) => `${item.lesson.id}|${item.at}`),
  );
  foregroundFired = new Set([...foregroundFired].filter((id) => currentIds.has(id)));
  foregroundTimer ??= setInterval(checkForegroundReminders, 15_000);
  if (foregroundTestPending) {
    foregroundTestPending = false;
    setTimeout(
      () =>
        showForeground(
          "上课提醒已开启",
          "当前浏览器将在课序保持打开时，于上课前 20 分钟提醒你。",
        ),
      0,
    );
  }
  checkForegroundReminders();
}
function stopForegroundReminders() {
  foregroundPlan = [];
  foregroundFired.clear();
  if (foregroundTimer) clearInterval(foregroundTimer);
  foregroundTimer = null;
}
export async function askNotifications(): Promise<ReminderMode> {
  if (typeof window === "undefined") return "foreground";
  prepareForegroundFeedback();
  const browser = installBrowser(navigator.userAgent, navigator.maxTouchPoints);
  const mayRequestSystemNotification =
    "Notification" in window && (browser.platform !== "ios" || installed());
  if (mayRequestSystemNotification && Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch {}
  }
  requestedMode =
    pushSupported() && Notification.permission === "granted"
      ? "system"
      : "foreground";
  foregroundTestPending = requestedMode === "foreground";
  systemTestPending = requestedMode === "system";
  return requestedMode;
}
export async function replaceReminders(
  snapshot: Snapshot | null,
  enabled: boolean,
  minutes: number,
) {
  if (typeof window === "undefined") return;
  if (!enabled || !snapshot) {
    stopForegroundReminders();
    if (!("serviceWorker" in navigator)) return;
    const active = await navigator.serviceWorker.getRegistration("/");
    const subscription = await active?.pushManager?.getSubscription();
    if (!subscription) return;
    const response = await fetch("/push", {
      method: "DELETE",
      credentials: "same-origin",
      headers: {
        ...WEB_GATEWAY_HEADERS,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });
    if (!response.ok) throw new Error(await errorMessage(response));
    await subscription.unsubscribe();
    return;
  }
  if (webReminderMode() === "foreground") {
    startForegroundReminders(snapshot, minutes);
    return "foreground" as const;
  }
  stopForegroundReminders();
  let active: ServiceWorkerRegistration;
  try {
    active = await registration();
  } catch {
    requestedMode = "foreground";
    foregroundTestPending = systemTestPending;
    systemTestPending = false;
    startForegroundReminders(snapshot, minutes);
    return "foreground" as const;
  }
  const configResponse = await fetch("/push?action=config", {
    credentials: "same-origin",
    cache: "no-store",
    headers: WEB_GATEWAY_HEADERS,
  });
  if (!configResponse.ok) throw new Error(await errorMessage(configResponse));
  const config = await configResponse.json();
  if (typeof config.publicKey !== "string") throw new Error("提醒服务配置无效");
  let previous: PushSubscription | null;
  let subscription: PushSubscription;
  try {
    previous = await active.pushManager.getSubscription();
    subscription =
      previous ??
      (await active.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey(config.publicKey),
      }));
  } catch {
    requestedMode = "foreground";
    foregroundTestPending = systemTestPending;
    systemTestPending = false;
    startForegroundReminders(snapshot, minutes);
    return "foreground" as const;
  }
  const reminders = reminderPlan(snapshot, minutes).map(({ lesson, at }) => ({
    id: `${lesson.id}|${at}`,
    at,
    title: `${minutes} 分钟后上课`,
    body: `${lesson.course.name} · ${lesson.start} · ${lesson.room || "地点待定"}`,
    url: "/",
  }));
  const response = await fetch("/push?action=subscribe", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      ...WEB_GATEWAY_HEADERS,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      reminders,
      test: !previous,
    }),
  });
  if (!response.ok) {
    if (!previous) await subscription.unsubscribe();
    throw new Error(await errorMessage(response));
  }
  if (systemTestPending) {
    systemTestPending = false;
    showReminderDialog(
      document,
      "上课提醒已开启",
      "后台系统通知已启用；课序页面打开时也会显示此类页面弹窗。",
    );
  }
  return "system" as const;
}
