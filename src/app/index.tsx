import { Platform, Text, View } from "react-native";
import { router } from "expo-router";
import HomeInstall from "../components/HomeInstall";
import { useStore } from "../state";
import {
  schoolDate,
  schoolDayLabel,
  weekOf,
  lessonsForWeek,
  nextLessonForHome,
  hasConflict,
  lessonEnded,
} from "../core/model";
import {
  Button,
  Caption,
  Card,
  CourseCard,
  Heading,
  Screen,
  Section,
  usePalette,
  useClock,
} from "../components/ui";
export default function Today() {
  const s = useStore(),
    c = usePalette(),
    web = Platform.OS === "web",
    now = useClock(),
    today = schoolDate(new Date(now)),
    week = s.snapshot ? weekOf(s.snapshot.monday, today) : 1;
  const all = s.snapshot ? lessonsForWeek(s.snapshot, week) : [],
    lessons = all.filter((l) => l.date === today);
  const next = s.snapshot ? nextLessonForHome(s.snapshot, now) : undefined;
  const sunday = new Date(`${today}T00:00:00Z`).getUTCDay() === 0;
  return (
    <Screen>
      <Heading
        eyebrow="课序 / CAMPUS TIMETABLE"
        title={s.snapshot ? "今天，从容一点" : web ? "你的课表，随手打开" : "你的课表，随校更新"}
        subtitle={
          s.snapshot
            ? `${today.replaceAll("-", " / ")} · ${week > 0 ? "第 " + week + " 教学周" : "尚未开学"}`
            : `湖北工业大学工程技术学院 · ${web ? "网页课表" : "iOS 课表"}`
        }
      />
      <HomeInstall />
      {!s.snapshot ? (
        <>
          <View
            style={{
              backgroundColor: c.soft,
              borderRadius: 28,
              padding: 28,
              gap: 20,
              marginBottom: 20,
            }}
          >
            <Text style={{ fontSize: 52, color: c.accent }}>▦</Text>
            <Text style={{ fontSize: 26, fontWeight: "700", color: c.text }}>
              课程安排，随手可见。
            </Text>
            <Text style={{ fontSize: 15, lineHeight: 25, color: c.muted }}>
              {web
                ? "绑定教务后，打开网页自动核对课表。课程变化保留在变更记录里。"
                : "绑定学校后，打开 App 自动核对课表。时间、教室和周次的变化，集中保留在变更记录里。"}
            </Text>
            <Button
              label="绑定学校教务"
              onPress={() => router.push("/settings")}
            />
            <Button label="先体验演示课表" secondary onPress={s.demo} />
          </View>
          <Card>
            <Text style={{ color: c.text, fontWeight: "600" }}>
              当前版本的同步范围
            </Text>
            <Caption>
              {web
                ? "打开网页时检查，前台每5分钟更新。网页关闭后不会持续同步。"
                : "支持打开 App 自动检查与前台定期同步。全天候后台同步与远程推送尚未接入。"}
            </Caption>
          </Card>
        </>
      ) : (
        <>
          <View
            style={{
              padding: 24,
              backgroundColor: c.accent,
              borderRadius: 26,
              gap: 12,
            }}
          >
            <Text
              style={{
                color: c.bg,
                fontSize: 12,
                fontWeight: "600",
                letterSpacing: 2,
              }}
            >
              {next ? "UP NEXT / 下一门课" : "TODAY / 今日安排"}
            </Text>
            <Text style={{ color: c.bg, fontSize: 27, fontWeight: "700" }}>
              {next?.course.name ?? "给自己留一点空白"}
            </Text>
            <Text style={{ color: c.bg, fontSize: 15, lineHeight: 23 }}>
              {next
                ? `${schoolDayLabel(next.date, today)} ${next.start}–${next.end}\n${next.room}`
                : sunday
                  ? "下周一暂无课程安排"
                  : "本周剩余时间暂无课程安排"}
            </Text>
          </View>
          <View style={{ marginTop: 16, gap: 7 }}>
            <Text style={{ color: c.accent, fontSize: 13, fontWeight: "600" }}>
              {s.saved.mode === "demo"
                ? "● 演示课表 · 非真实同步"
                : "● " + s.status}
            </Text>
            <Caption>
              {s.saved.mode === "demo"
                ? "课程为虚构示例，可在变更页体验调课。"
                : `最后成功核对：${new Date(s.snapshot.capturedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`}
            </Caption>
          </View>
          <Section
            title={`今日课程 · ${lessons.length}`}
            action={
              s.saved.mode === "school" ? (
                <Button
                  label={s.busy ? "同步中…" : "立即同步"}
                  secondary
                  disabled={s.busy}
                  onPress={s.sync}
                />
              ) : undefined
            }
          />
          {lessons.length ? (
            lessons.map((l) => (
              <CourseCard
                key={l.id}
                lesson={l}
                conflict={hasConflict(l, all)}
                ended={lessonEnded(l, now)}
              />
            ))
          ) : (
            <Card>
              <Text style={{ color: c.text, fontSize: 18 }}>
                今天没有安排课程
              </Text>
              <Caption>可以切换到课表查看其他日期。</Caption>
            </Card>
          )}
          {s.pending && (
            <Caption>
              课程减少或学期发生变化，旧课表暂时保留，下一次同步将再次复核。
            </Caption>
          )}
          <Section title="同步状态" />
          <Card>
            <Text style={{ color: c.text, lineHeight: 23 }}>{s.status}</Text>
            <Caption>
              前台每5分钟检查一次；应用关闭时不会持续请求教务系统。学校未发布的临时通知需另行确认。
            </Caption>
          </Card>
        </>
      )}
    </Screen>
  );
}
