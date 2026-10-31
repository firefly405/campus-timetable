import test from "node:test";
import assert from "node:assert/strict";
import {
  HEADERS,
  addDays,
  allowedSchoolURL,
  changesBetween,
  contentKey,
  expandRows,
  hasConflict,
  lessonsForWeek,
  lessonEnded,
  mondayFromWeek,
  nextLessonForHome,
  parseSnapshot,
  parseWeeks,
  reminderPlan,
  requiresVerification,
  schoolDate,
  schoolDayLabel,
  weekOf,
} from "../src/core/model.ts";
import type { RawSnapshot, Cell } from "../src/core/model.ts";

const cell = (text: string, rowSpan = 1): Cell => ({
  text,
  rowSpan,
  colSpan: 1,
});
function fixture(): RawSnapshot {
  return {
    source: "urp-dom-v1",
    term: "2026-2027 秋季",
    currentWeek: 7,
    capturedAt: "2026-10-15T01:00:00Z",
    headers: HEADERS,
    periods: [
      { period: 1, start: "08:20", end: "09:05" },
      { period: 2, start: "09:10", end: "09:55" },
      { period: 3, start: "10:15", end: "11:00" },
      { period: 4, start: "11:05", end: "11:50" },
    ],
    rows: [
      [
        "TEST01",
        "示例英语",
        "",
        "",
        "01",
        "2",
        "必修",
        "",
        "",
        "示例教师",
        "正常",
        "置入",
        "7-12周>>星期四>>1-2节",
        "教学楼>>A201",
      ].map((x) => cell(x)),
    ],
  };
}

test("parses ranges, odd/even and single/disjoint weeks", () => {
  assert.deepEqual(parseWeeks("1-6周(单)"), [1, 3, 5]);
  assert.deepEqual(parseWeeks("第13周"), [13]);
  assert.deepEqual(parseWeeks("2-8周（双周）"), [2, 4, 6, 8]);
  assert.deepEqual(parseWeeks("1、3、5-6周"), [1, 3, 5, 6]);
  assert.throws(() => parseWeeks("待定"));
  assert.throws(() => parseWeeks("18-2周"));
  assert.throws(() => parseWeeks("1-999周"));
  assert.throws(() => parseWeeks("1周(双)"));
});
test("expands merged rows without dropping continuation meetings", () => {
  const f = fixture();
  f.rows[0].slice(0, 12).forEach((c) => (c.rowSpan = 2));
  f.rows.push([cell("13-17周>>星期二>>3-4节"), cell("教学楼>>A202")]);
  const s = parseSnapshot(f);
  assert.equal(s.courses.length, 1);
  assert.equal(s.courses[0].meetings.length, 2);
  assert.equal(lessonsForWeek(s, 14)[0].start, "10:15");
  assert.throws(() => expandRows([[cell("x", 2)]], 1));
});
test("same course code with a subsidiary group remains distinct; unscheduled courses survive", () => {
  const f = fixture();
  const r = f.rows[0].map((c) => ({ ...c }));
  r[4].text = "FS01（主课序号：01）";
  r[12].text = "";
  r[13].text = "";
  f.rows.push(r);
  const s = parseSnapshot(f);
  assert.equal(s.courses.length, 2);
  assert.equal(s.courses.filter((c) => !c.meetings.length).length, 1);
});
test("rejects empty, partial, malformed and unrecognized source snapshots", () => {
  const f = fixture();
  assert.throws(() => parseSnapshot({ ...f, rows: [] }));
  assert.throws(() => parseSnapshot({ ...f, headers: ["课程名"] }));
  const bad = fixture();
  bad.rows[0].pop();
  assert.throws(() => parseSnapshot(bad));
  const unknown = fixture();
  unknown.rows[0][12].text = "以后再定";
  assert.throws(() => parseSnapshot(unknown));
  assert.throws(() =>
    parseSnapshot({
      ...f,
      periods: [{ period: 1, start: "99:00", end: "09:00" }],
    }),
  );
  assert.throws(() => parseSnapshot({ ...f, rows: [[cell("x", 99999999)]] }));
});
test("canonical results ignore row ordering, repeated meetings and capture time", () => {
  const f = fixture(),
    a = parseSnapshot(f);
  const duplicate = fixture();
  duplicate.rows.push(duplicate.rows[0]);
  duplicate.capturedAt = "2026-10-15T02:00:00Z";
  const b = parseSnapshot(duplicate);
  assert.equal(contentKey(a), contentKey(b));
  assert.deepEqual(changesBetween(a, b), []);
});
test("location changes are recorded and date reminders use corrected values", () => {
  const a = parseSnapshot(fixture());
  const f = fixture();
  f.rows[0][13].text = "教学楼>>B301";
  const b = parseSnapshot(f);
  const changes = changesBetween(a, b);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].type, "changed");
  assert.equal(
    reminderPlan(b, 15, Date.parse("2026-10-15T00:00:00Z"))[0].lesson.room,
    "教学楼 · B301",
  );
  assert.equal(
    reminderPlan(b, 15, 0)[0].at,
    Date.parse("2026-10-15T08:05:00+08:00"),
  );
});
test("removed schedules and term shifts require confirmation by a second stable snapshot", () => {
  const a = parseSnapshot(fixture());
  const f = fixture();
  f.rows[0][12].text = "第7周>>星期四>>1-2节";
  const b = parseSnapshot(f);
  assert.equal(requiresVerification(a, b), true);
  assert.equal(requiresVerification(a, a), false);
  assert.equal(requiresVerification(a, { ...a, term: "2026-2027 春季" }), true);
});
test("China timezone and teaching weeks are independent of device timezone", () => {
  assert.equal(schoolDate(new Date("2026-10-14T18:00:00Z")), "2026-10-15");
  assert.equal(mondayFromWeek(7, "2026-10-15"), "2026-08-31");
  assert.equal(weekOf("2026-08-31", "2026-10-15"), 7);
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});
test("labels the next two school days before falling back to the date", () => {
  assert.equal(schoolDayLabel("2026-12-31", "2026-12-31"), "今天");
  assert.equal(schoolDayLabel("2027-01-01", "2026-12-31"), "明天");
  assert.equal(schoolDayLabel("2027-01-02", "2026-12-31"), "后天");
  assert.equal(schoolDayLabel("2027-01-03", "2026-12-31"), "2027-01-03");
});
test("Sunday home card advances to the first lesson on next Monday", () => {
  const f = fixture();
  const monday = f.rows[0].map((value) => ({ ...value }));
  monday[0].text = "TEST02";
  monday[1].text = "下周课程";
  monday[4].text = "02";
  monday[12].text = "第8周>>星期一>>1-2节";
  f.rows.push(monday);
  const lesson = nextLessonForHome(
    parseSnapshot(f),
    Date.parse("2026-10-18T20:00:00+08:00"),
  );
  assert.equal(lesson?.date, "2026-10-19");
  assert.equal(lesson?.course.name, "下周课程");
  assert.equal(schoolDayLabel(lesson!.date, "2026-10-18"), "明天");
});
test("marks a lesson ended at its Beijing-time end boundary", () => {
  const lesson = lessonsForWeek(parseSnapshot(fixture()), 7)[0];
  assert.equal(lessonEnded(lesson, Date.parse("2026-10-15T09:54:59+08:00")), false);
  assert.equal(lessonEnded(lesson, Date.parse("2026-10-15T09:55:00+08:00")), true);
});
test("conflicting teaching groups are visible and adjacent classes do not conflict", () => {
  const a = lessonsForWeek(parseSnapshot(fixture()), 7)[0];
  assert.equal(hasConflict(a, [a, { ...a, id: "other" }]), true);
  assert.equal(
    hasConflict(a, [a, { ...a, id: "adjacent", start: "09:55", end: "10:40" }]),
    false,
  );
});
test("allows only observed school read/login pages; rejects third-party and credential URLs", () => {
  assert.equal(allowedSchoolURL("http://202.114.190.75/login"), true);
  assert.equal(
    allowedSchoolURL("http://202.114.190.75.evil.invalid/login"),
    false,
  );
  assert.equal(
    allowedSchoolURL("http://user:password@202.114.190.75/login"),
    false,
  );
  assert.equal(allowedSchoolURL("javascript:alert(1)"), false);
  assert.equal(
    allowedSchoolURL(
      "http://202.114.190.75/student/courseSelect/quitCourse/index",
    ),
    false,
  );
});
test("caps rolling reminder queue below iOS limit and excludes past notifications", () => {
  const f = fixture();
  f.rows[0][12].text = "1-60周>>星期四>>1-2节";
  const s = parseSnapshot(f);
  assert.equal(reminderPlan(s, 15, 0).length, 50);
  assert.equal(reminderPlan(s, 15, Date.parse("2030-01-01")).length, 0);
});
