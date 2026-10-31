import { requireOptionalNativeModule } from "expo";
import * as Notifications from "expo-notifications";
import { reminderPlan, Snapshot } from "../core/model";
export type ReminderMode = "system" | "foreground";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
export const canClearSession = () =>
  !!requireOptionalNativeModule("CampusSession");
export async function clearSchoolSession() {
  const module = requireOptionalNativeModule<{ clear: () => Promise<void> }>(
    "CampusSession",
  );
  if (!module)
    throw new Error("教务绑定需要专用 iOS 开发包，Expo Go 仅用于界面预览");
  await module.clear();
}
export function webReminderMode(): ReminderMode {
  return "system";
}
export async function askNotifications(): Promise<ReminderMode> {
  const permission = await Notifications.requestPermissionsAsync();
  const granted =
    permission.granted ||
    permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (!granted) throw new Error("请在系统设置中开启通知权限");
  return "system";
}
let notificationQueue: Promise<void> = Promise.resolve();
export function replaceReminders(
  snapshot: Snapshot | null,
  enabled: boolean,
  minutes: number,
) {
  const job = notificationQueue
    .catch(() => {})
    .then(async () => {
      await Notifications.cancelAllScheduledNotificationsAsync();
      if (!snapshot || !enabled) return;
      const permission = await Notifications.getPermissionsAsync();
      if (
        !permission.granted &&
        permission.ios?.status !==
          Notifications.IosAuthorizationStatus.PROVISIONAL
      )
        throw new Error("通知权限未开启，请在 iPhone 设置中允许通知");
      try {
        for (const item of reminderPlan(snapshot, minutes)) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "即将上课",
              body: `${item.lesson.course.name} · ${item.lesson.start} · ${item.lesson.room || "地点待定"}`,
              data: { courseId: item.lesson.course.id },
              sound: true,
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: new Date(item.at),
            },
          });
        }
      } catch (error) {
        await Notifications.cancelAllScheduledNotificationsAsync();
        throw error;
      }
    });
  notificationQueue = job;
  return job;
}
