import React, { createContext, useContext, useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  useColorScheme,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Course, Lesson } from "../core/model";
import { DEFAULT_THEME_COLOR, themePalette } from "../core/theme";
const PaletteContext = createContext(themePalette(DEFAULT_THEME_COLOR, false));
export function ThemeProvider({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}) {
  const palette = themePalette(color, useColorScheme() === "dark");
  return (
    <PaletteContext.Provider value={palette}>
      {children}
    </PaletteContext.Provider>
  );
}
export function usePalette() {
  return useContext(PaletteContext);
}
export function useClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  return now;
}
export function Screen({ children }: { children: React.ReactNode }) {
  const c = usePalette();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={styles.page}
    >
      {children}
    </ScrollView>
  );
}
export function Heading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  const c = usePalette();
  return (
    <View style={{ gap: 8, marginBottom: 24 }}>
      <Text
        style={{
          color: c.accent,
          fontSize: 12,
          fontWeight: "700",
          letterSpacing: 2,
        }}
      >
        {eyebrow}
      </Text>
      <Text
        accessibilityRole="header"
        style={{
          color: c.text,
          fontSize: 32,
          fontWeight: "700",
          letterSpacing: -1,
        }}
      >
        {title}
      </Text>
      {subtitle && (
        <Text style={{ color: c.muted, lineHeight: 22, fontSize: 14 }}>
          {subtitle}
        </Text>
      )}
    </View>
  );
}
export function Button({
  label,
  onPress,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  const c = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: secondary ? c.soft : c.accent,
        opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
      })}
    >
      <Text
        style={{
          fontSize: 15,
          fontWeight: "600",
          color: secondary ? c.text : c.bg,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Card({ children }: { children: React.ReactNode }) {
  const c = usePalette();
  return (
    <View
      style={{
        backgroundColor: c.card,
        borderRadius: 22,
        padding: 20,
        borderWidth: 1,
        borderColor: c.line,
        gap: 12,
      }}
    >
      {children}
    </View>
  );
}
export function Caption({ children }: { children: React.ReactNode }) {
  const c = usePalette();
  return (
    <Text style={{ color: c.muted, fontSize: 13, lineHeight: 20 }}>
      {children}
    </Text>
  );
}
export function Section({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  const c = usePalette();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        marginTop: 25,
        marginBottom: 14,
      }}
    >
      <Text
        accessibilityRole="header"
        style={{ color: c.text, fontSize: 19, fontWeight: "700" }}
      >
        {title}
      </Text>
      {action}
    </View>
  );
}
export function Details({
  course,
  visible,
  close,
}: {
  course: Course;
  visible: boolean;
  close: () => void;
}) {
  const c = usePalette();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        <Screen>
          <Button label="关闭课程详情" onPress={close} secondary />
          <View style={{ height: 24 }} />
          <Heading
            eyebrow="COURSE DETAILS"
            title={course.name}
            subtitle={`${course.code} · 教学班 ${course.group}`}
          />
          <Card>
            <Text style={{ fontSize: 18, color: c.text, fontWeight: "600" }}>
              {course.teacher || "教师待定"}
            </Text>
            <Caption>{course.credits} 学分 · 课程时间均为学校所在时区</Caption>
          </Card>
          <Section title="上课安排" />
          {!course.meetings.length && (
            <Caption>学校暂未安排具体上课时间，请关注教务公告。</Caption>
          )}
          {course.meetings.map((m, i) => (
            <View key={i} style={{ marginBottom: 12 }}>
              <Card>
                <Text
                  style={{ fontSize: 17, fontWeight: "600", color: c.text }}
                >
                  周{"一二三四五六日"[m.day - 1]}　{m.start}–{m.end}
                </Text>
                <Text style={{ color: c.text }}>{m.room || "教室待定"}</Text>
                <Caption>
                  第 {m.weeks.join("、")} 周 · {m.startPeriod}–{m.endPeriod} 节
                </Caption>
              </Card>
            </View>
          ))}
        </Screen>
      </SafeAreaView>
    </Modal>
  );
}
export function CourseCard({
  lesson,
  conflict = false,
  ended = false,
}: {
  lesson: Lesson;
  conflict?: boolean;
  ended?: boolean;
}) {
  const c = usePalette();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${lesson.course.name}，${lesson.start}至${lesson.end}，${lesson.room}${ended ? "，已结束" : ""}，查看详情`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          opacity: pressed ? 0.7 : 1,
          flexDirection: "row",
          marginBottom: 12,
          backgroundColor: ended ? c.warm : c.card,
          borderWidth: 1,
          borderColor: ended ? c.warning : c.line,
          borderRadius: 20,
          overflow: "hidden",
        })}
      >
        <View
          style={{
            width: 5,
            backgroundColor: conflict || ended ? c.warning : c.accent,
          }}
        />
        <View style={{ padding: 16, flex: 1, gap: 8 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <Text style={{ color: c.accent, fontWeight: "600", fontSize: 13 }}>
              {lesson.start} — {lesson.end}
            </Text>
            <Text
              style={{ color: conflict ? c.warning : c.muted, fontSize: 12 }}
            >
              {conflict
                ? "时间冲突"
                : ended
                  ? "已结束"
                : `${lesson.startPeriod}–${lesson.endPeriod} 节`}
            </Text>
          </View>
          <Text style={{ color: c.text, fontSize: 19, fontWeight: "700" }}>
            {lesson.course.name}
          </Text>
          <Text style={{ color: c.muted, lineHeight: 20 }}>
            {lesson.room || "教室待定"}　·　
            {lesson.course.teacher || "教师待定"}
          </Text>
        </View>
      </Pressable>
      <Details
        course={lesson.course}
        visible={open}
        close={() => setOpen(false)}
      />
    </>
  );
}
export const styles = StyleSheet.create({
  page: {
    padding: 24,
    paddingBottom: 40,
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  gap: { gap: 12 },
});
