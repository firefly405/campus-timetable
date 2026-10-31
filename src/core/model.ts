export const SCHOOL = "湖北工业大学工程技术学院";
export const SCHOOL_ORIGIN = "http://202.114.190.75";
export const COURSE_PATH = "/student/courseSelect/thisSemesterCurriculum/index";
export const COURSE_URL = SCHOOL_ORIGIN + COURSE_PATH;
export const HEADERS = [
  "课程号",
  "课程名",
  "教学日历",
  "教学大纲",
  "课序号",
  "学分",
  "课程属性",
  "课程类别",
  "考试类型",
  "教师",
  "修读方式",
  "选课状态",
  "时间",
  "地点",
];
export type Cell = { text: string; rowSpan: number; colSpan: number };
export type Period = { period: number; start: string; end: string };
export type RawSnapshot = {
  source: "urp-dom-v1";
  term: string;
  currentWeek: number;
  capturedAt: string;
  headers: string[];
  rows: Cell[][];
  periods: Period[];
};
export type Meeting = {
  weeks: number[];
  day: number;
  startPeriod: number;
  endPeriod: number;
  start: string;
  end: string;
  room: string;
};
export type Course = {
  id: string;
  code: string;
  group: string;
  name: string;
  teacher: string;
  credits: string;
  meetings: Meeting[];
};
export type Snapshot = {
  term: string;
  monday: string;
  capturedAt: string;
  courses: Course[];
  periods: Period[];
};
export type Change = {
  id: string;
  at: string;
  title: string;
  type: "added" | "changed" | "removed";
  before?: Course;
  after?: Course;
  read: boolean;
};
export type Lesson = {
  id: string;
  course: Course;
  date: string;
  start: string;
  end: string;
  room: string;
  startPeriod: number;
  endPeriod: number;
};
const DAY_MS = 86400000;

export function schoolDate(now = new Date()): string {
  return new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10);
}
export function lessonEnded(lesson: Lesson, now = Date.now()): boolean {
  return Date.parse(`${lesson.date}T${lesson.end}:00+08:00`) <= now;
}
export function addDays(day: string, days: number): string {
  return new Date(Date.parse(day + "T00:00:00Z") + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}
export function schoolDayLabel(date: string, today = schoolDate()): string {
  if (date === today) return "今天";
  if (date === addDays(today, 1)) return "明天";
  if (date === addDays(today, 2)) return "后天";
  return date;
}
export function weekOf(monday: string, date = schoolDate()): number {
  return (
    Math.floor(
      (Date.parse(date + "T00:00:00Z") - Date.parse(monday + "T00:00:00Z")) /
        (7 * DAY_MS),
    ) + 1
  );
}
export function mondayFromWeek(week: number, date: string): string {
  const dow = new Date(date + "T00:00:00Z").getUTCDay() || 7;
  return addDays(date, -(dow - 1) - (week - 1) * 7);
}
export function parseWeeks(input: string): number[] {
  let value = input
    .replace(/\s/g, "")
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")")
    .replace(/[，、]/g, ",");
  const parity = value.includes("单") ? 1 : value.includes("双") ? 0 : null;
  value = value
    .replace(/\((?:单|双)(?:周)?\)/g, "")
    .replace(/(?:单|双)周?/g, "")
    .replace(/[第周]/g, "");
  if (!/^\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/.test(value))
    throw new Error("无法识别周次：" + input);
  const weeks = new Set<number>();
  for (const part of value.split(",")) {
    const [start, last] = part.split("-").map(Number);
    const end = last ?? start;
    if (start < 1 || end > 60 || start > end) throw new Error("周次超出范围");
    for (let n = start; n <= end; n++)
      if (parity === null || n % 2 === parity) weeks.add(n);
  }
  if (!weeks.size) throw new Error("周次范围为空");
  return [...weeks].sort((a, b) => a - b);
}
export function expandRows(rows: Cell[][], width: number): string[][] {
  const grid: string[][] = [];
  rows.forEach((row, r) => {
    grid[r] ??= [];
    let col = 0;
    for (const cell of row) {
      while (grid[r][col] !== undefined) col++;
      if (col + cell.colSpan > width || r + cell.rowSpan > rows.length)
        throw new Error("表格结构发生变化");
      for (let dy = 0; dy < cell.rowSpan; dy++)
        for (let dx = 0; dx < cell.colSpan; dx++) {
          grid[r + dy] ??= [];
          if (grid[r + dy][col + dx] !== undefined)
            throw new Error("课表单元格重叠");
          grid[r + dy][col + dx] = cell.text.trim();
        }
      col += cell.colSpan;
    }
    if (
      grid[r].length !== width ||
      Array.from({ length: width }, (_, i) => grid[r][i]).some(
        (x) => x === undefined,
      )
    )
      throw new Error("课表尚未完整加载");
  });
  return grid;
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function validTime(value: unknown): value is string {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}
export function validateRaw(input: unknown): RawSnapshot {
  if (
    !object(input) ||
    input.source !== "urp-dom-v1" ||
    typeof input.term !== "string" ||
    !/^\d{4}-\d{4}.+(?:春|秋|学期)/.test(input.term) ||
    input.term.length > 60
  )
    throw new Error("学期信息无效");
  if (
    !Number.isInteger(input.currentWeek) ||
    Number(input.currentWeek) < 1 ||
    Number(input.currentWeek) > 60
  )
    throw new Error("当前教学周无效");
  if (
    typeof input.capturedAt !== "string" ||
    !Number.isFinite(Date.parse(input.capturedAt))
  )
    throw new Error("同步时间无效");
  if (
    !Array.isArray(input.headers) ||
    input.headers.join("|") !== HEADERS.join("|")
  )
    throw new Error("学校课表列结构发生变化，保留原课表");
  if (
    !Array.isArray(input.rows) ||
    input.rows.length < 1 ||
    input.rows.length > 2000
  )
    throw new Error("未取得完整课表，保留原数据");
  for (const row of input.rows) {
    if (!Array.isArray(row) || !row.length || row.length > 14)
      throw new Error("课表行无效");
    for (const c of row)
      if (
        !object(c) ||
        typeof c.text !== "string" ||
        c.text.length > 2000 ||
        !Number.isInteger(c.rowSpan) ||
        Number(c.rowSpan) < 1 ||
        Number(c.rowSpan) > 2000 ||
        !Number.isInteger(c.colSpan) ||
        Number(c.colSpan) !== 1
      )
        throw new Error("课表单元格无效");
  }
  if (
    !Array.isArray(input.periods) ||
    input.periods.length < 1 ||
    input.periods.length > 24
  )
    throw new Error("未取得学校作息时间");
  const seen = new Set<number>();
  for (const p of input.periods) {
    if (
      !object(p) ||
      !Number.isInteger(p.period) ||
      Number(p.period) < 1 ||
      Number(p.period) > 24 ||
      !validTime(p.start) ||
      !validTime(p.end) ||
      p.start >= p.end ||
      seen.has(Number(p.period))
    )
      throw new Error("学校节次时间无效");
    seen.add(Number(p.period));
  }
  return input as RawSnapshot;
}
export function parseSnapshot(input: unknown): Snapshot {
  const raw = validateRaw(input);
  const courses = new Map<string, Course>();
  const periods = new Map(raw.periods.map((p) => [p.period, p]));
  for (const row of expandRows(raw.rows, HEADERS.length)) {
    const [code, name, , , group, credits, , , , teacher, , , time, room] = row;
    if (!code || !name || !group) throw new Error("课程标识不完整");
    const id = code + "::" + group;
    const course = courses.get(id) ?? {
      id,
      code,
      name,
      group,
      credits,
      teacher: teacher.replace(/\*/g, ""),
      meetings: [],
    };
    if (course.name !== name || course.teacher !== teacher.replace(/\*/g, ""))
      throw new Error("同一教学班返回了不一致的信息");
    if (time) {
      const parts = time.split(">>").map((x) => x.trim());
      const day = /^星期([一二三四五六日天])$/.exec(parts[1] ?? "");
      const section = /^(\d+)(?:-(\d+))?节$/.exec(parts[2] ?? "");
      if (parts.length !== 3 || !day || !section)
        throw new Error("无法识别课程安排：" + time);
      const startPeriod = Number(section[1]),
        endPeriod = Number(section[2] ?? section[1]);
      const start = periods.get(startPeriod)?.start,
        end = periods.get(endPeriod)?.end;
      if (!start || !end || endPeriod < startPeriod || end <= start)
        throw new Error("课程节次与学校作息不一致");
      course.meetings.push({
        weeks: parseWeeks(parts[0]),
        day: day[1] === "天" ? 7 : "一二三四五六日".indexOf(day[1]) + 1,
        startPeriod,
        endPeriod,
        start,
        end,
        room: room.split(">>").join(" · "),
      });
    }
    courses.set(id, course);
  }
  for (const c of courses.values()) {
    c.meetings = [
      ...new Map(c.meetings.map((m) => [JSON.stringify(m), m])).values(),
    ].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }
  return {
    term: raw.term.trim(),
    monday: mondayFromWeek(
      raw.currentWeek,
      schoolDate(new Date(raw.capturedAt)),
    ),
    capturedAt: raw.capturedAt,
    periods: raw.periods,
    courses: [...courses.values()].sort((a, b) => a.id.localeCompare(b.id)),
  };
}
export function contentKey(snapshot: Snapshot): string {
  return JSON.stringify([
    snapshot.term,
    snapshot.monday,
    snapshot.courses,
    snapshot.periods,
  ]);
}
export function changesBetween(before: Snapshot, after: Snapshot): Change[] {
  const oldMap = new Map(before.courses.map((c) => [c.id, c]));
  const newMap = new Map(after.courses.map((c) => [c.id, c]));
  const changes: Change[] = [];
  for (const id of new Set([...oldMap.keys(), ...newMap.keys()])) {
    const old = oldMap.get(id),
      current = newMap.get(id);
    if (JSON.stringify(old) === JSON.stringify(current)) continue;
    changes.push({
      id: after.capturedAt + "|" + id,
      at: after.capturedAt,
      title: (current ?? old)!.name,
      type: !old ? "added" : !current ? "removed" : "changed",
      before: old,
      after: current,
      read: false,
    });
  }
  return changes;
}
export function lessonsForWeek(snapshot: Snapshot, week: number): Lesson[] {
  const lessons = new Map<string, Lesson>();
  for (const course of snapshot.courses)
    for (const m of course.meetings)
      if (m.weeks.includes(week)) {
        const date = addDays(snapshot.monday, (week - 1) * 7 + m.day - 1);
        const id =
          course.id + "|" + date + "|" + m.start + "|" + m.end + "|" + m.room;
        lessons.set(id, {
          id,
          course,
          date,
          start: m.start,
          end: m.end,
          room: m.room,
          startPeriod: m.startPeriod,
          endPeriod: m.endPeriod,
        });
      }
  return [...lessons.values()].sort((a, b) =>
    (a.date + a.start).localeCompare(b.date + b.start),
  );
}
export function nextLessonForHome(
  snapshot: Snapshot,
  now = Date.now(),
): Lesson | undefined {
  const today = schoolDate(new Date(now));
  const week = weekOf(snapshot.monday, today);
  const current = lessonsForWeek(snapshot, week).find(
    (lesson) =>
      Date.parse(`${lesson.date}T${lesson.end}:00+08:00`) > now,
  );
  if (current) return current;
  if (new Date(`${today}T00:00:00Z`).getUTCDay() !== 0) return undefined;
  const nextMonday = addDays(today, 1);
  return lessonsForWeek(snapshot, week + 1).find(
    (lesson) => lesson.date === nextMonday,
  );
}
export function hasConflict(lesson: Lesson, all: Lesson[]): boolean {
  return all.some(
    (other) =>
      other.id !== lesson.id &&
      other.date === lesson.date &&
      other.start < lesson.end &&
      lesson.start < other.end,
  );
}
export function reminderPlan(
  snapshot: Snapshot,
  minutes: number,
  now = Date.now(),
): { lesson: Lesson; at: number }[] {
  const maxWeek = Math.max(
    1,
    ...snapshot.courses.flatMap((c) => c.meetings.flatMap((m) => m.weeks)),
  );
  const plan = [];
  for (let week = 1; week <= maxWeek; week++)
    for (const lesson of lessonsForWeek(snapshot, week)) {
      const at =
        Date.parse(lesson.date + "T" + lesson.start + ":00+08:00") -
        minutes * 60000;
      if (at > now) plan.push({ lesson, at });
    }
  return plan.sort((a, b) => a.at - b.at).slice(0, 50);
}
export function requiresVerification(
  before: Snapshot,
  after: Snapshot,
): boolean {
  if (before.term !== after.term || before.monday !== after.monday) return true;
  const next = new Map(after.courses.map((c) => [c.id, c]));
  return before.courses.some(
    (c) =>
      !next.has(c.id) ||
      c.meetings.reduce((n, m) => n + m.weeks.length, 0) >
        next.get(c.id)!.meetings.reduce((n, m) => n + m.weeks.length, 0),
  );
}
export function allowedSchoolURL(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.origin === SCHOOL_ORIGIN &&
      ["/", "/login", "/j_spring_security_check", COURSE_PATH].includes(
        url.pathname,
      ) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
