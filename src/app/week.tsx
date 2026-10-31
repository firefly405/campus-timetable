import { useState } from "react";
import { ScrollView, Text, View, Pressable } from "react-native";
import { useStore } from "../state";
import {
  Course,
  addDays,
  hasConflict,
  lessonsForWeek,
  weekOf,
} from "../core/model";
import {
  Button,
  Caption,
  Card,
  CourseCard,
  Details,
  Heading,
  Screen,
  Section,
  usePalette,
} from "../components/ui";
export default function Week() {
  const s = useStore(),
    c = usePalette(),
    [offset, setOffset] = useState(0),
    [selected, setSelected] = useState<Course | null>(null);
  const base = s.snapshot ? Math.max(1, weekOf(s.snapshot.monday)) : 1,
    week = base + offset;
  if (!s.snapshot)
    return (
      <Screen>
        <Heading eyebrow="WEEKLY SCHEDULE" title="本周课表" />
        <Card>
          <Caption>绑定教务或进入演示后，可查看每周课程。</Caption>
          <Button label="体验演示课表" onPress={s.demo} />
        </Card>
      </Screen>
    );
  const lessons = lessonsForWeek(s.snapshot, week),
    monday = addDays(s.snapshot.monday, (week - 1) * 7),
    days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const unscheduled = s.snapshot.courses.filter((x) => !x.meetings.length);
  return (
    <Screen>
      <Heading
        eyebrow="WEEKLY SCHEDULE"
        title={`第 ${week} 周`}
        subtitle={`${s.snapshot.term} · ${monday} 至 ${addDays(monday, 6)}`}
      />
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
        <Button
          label="上一周"
          secondary
          disabled={week <= 1}
          onPress={() => setOffset((o) => o - 1)}
        />
        <Button label="本周" secondary onPress={() => setOffset(0)} />
        <Button
          label="下一周"
          secondary
          disabled={week >= 60}
          onPress={() => setOffset((o) => o + 1)}
        />
      </View>
      <Caption>
        左右滑动查看全周，点击课程查看完整安排。时间均为北京时间。
      </Caption>
      <ScrollView horizontal style={{ marginTop: 14 }}>
        <View style={{ flexDirection: "row", gap: 8, paddingBottom: 10 }}>
          {days.map((day, i) => (
            <View key={day} style={{ width: 102, gap: 9 }}>
              <View
                style={{
                  paddingVertical: 14,
                  backgroundColor: c.soft,
                  borderRadius: 14,
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <Text style={{ fontWeight: "700", color: c.text }}>
                  周{"一二三四五六日"[i]}
                </Text>
                <Text style={{ color: c.muted, fontSize: 12 }}>
                  {day.slice(5)}
                </Text>
              </View>
              {lessons
                .filter((l) => l.date === day)
                .map((l) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${l.course.name}，周${"一二三四五六日"[i]}，${l.start}，详情`}
                    key={l.id}
                    onPress={() => setSelected(l.course)}
                    style={{
                      padding: 12,
                      minHeight: 126,
                      borderRadius: 14,
                      backgroundColor: c.card,
                      borderWidth: 1,
                      borderColor: hasConflict(l, lessons) ? c.warning : c.line,
                      gap: 7,
                    }}
                  >
                    <Text
                      style={{
                        color: c.accent,
                        fontSize: 12,
                        fontWeight: "600",
                      }}
                    >
                      {l.start}
                    </Text>
                    <Text
                      style={{
                        color: c.text,
                        fontWeight: "600",
                        lineHeight: 20,
                      }}
                    >
                      {l.course.name}
                    </Text>
                    <Text
                      style={{ color: c.muted, fontSize: 11, lineHeight: 17 }}
                    >
                      {l.room || "教室待定"}
                    </Text>
                    {hasConflict(l, lessons) && (
                      <Text style={{ color: c.warning, fontSize: 11 }}>
                        时间冲突
                      </Text>
                    )}
                  </Pressable>
                ))}
            </View>
          ))}
        </View>
      </ScrollView>
      <Section title={`本周课程 · ${lessons.length}`} />
      {days.map((day, i) => {
        const list = lessons.filter((l) => l.date === day);
        return list.length ? (
          <View key={day}>
            <Text style={{ marginBottom: 12, marginTop: 10, color: c.muted }}>
              周{"一二三四五六日"[i]} · {day.slice(5)}
            </Text>
            {list.map((l) => (
              <CourseCard
                key={l.id}
                lesson={l}
                conflict={hasConflict(l, lessons)}
              />
            ))}
          </View>
        ) : null;
      })}
      {!lessons.length && (
        <Card>
          <Caption>本周暂无安排，请核对学期与同步时间。</Caption>
        </Card>
      )}
      {unscheduled.length > 0 && (
        <>
          <Section title={`尚未排时间 · ${unscheduled.length}`} />
          {unscheduled.map((course) => (
            <Pressable
              accessibilityRole="button"
              key={course.id}
              onPress={() => setSelected(course)}
              style={{ padding: 18, borderBottomWidth: 1, borderColor: c.line }}
            >
              <Text style={{ color: c.text, fontSize: 16 }}>{course.name}</Text>
              <Caption>
                {course.code} · {course.group}
              </Caption>
            </Pressable>
          ))}
        </>
      )}
      {selected && (
        <Details course={selected} visible close={() => setSelected(null)} />
      )}
    </Screen>
  );
}
