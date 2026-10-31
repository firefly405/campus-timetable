import { HEADERS, RawSnapshot, parseSnapshot } from "./model";
// Fictional fixtures: no data copied from the student's browser session.
const periods = [
  ["08:20", "09:05"],
  ["09:10", "09:55"],
  ["10:15", "11:00"],
  ["11:05", "11:50"],
  ["14:00", "14:45"],
  ["14:50", "15:35"],
  ["15:55", "16:40"],
  ["16:45", "17:30"],
  ["18:30", "19:15"],
  ["19:20", "20:05"],
].map(([start, end], i) => ({ period: i + 1, start, end }));
const course = (
  code: string,
  name: string,
  day: string,
  section: string,
  room: string,
) =>
  [
    code,
    name,
    "",
    "",
    "01",
    "2",
    "必修",
    "普通课",
    "",
    "示例教师",
    "正常",
    "置入",
    `1-18周>>星期${day}>>${section}节`,
    room,
  ].map((text) => ({ text, rowSpan: 1, colSpan: 1 }));
export function demoRaw(now = new Date()): RawSnapshot {
  return {
    source: "urp-dom-v1",
    term: "2026-2027 秋季",
    currentWeek: 7,
    capturedAt: now.toISOString(),
    headers: HEADERS,
    periods,
    rows: [
      course("DEMO01", "综合英语", "一", "1-2", "教学楼 · A201"),
      course("DEMO02", "英语视听说", "三", "3-4", "教学楼 · B302"),
      course("DEMO03", "大学体育", "四", "3-4", "田径场"),
      course("DEMO04", "人工智能导论", "四", "5-6", "实验楼 · C106"),
      course("DEMO05", "英语阅读", "五", "1-2", "教学楼 · A205"),
      course("DEMO06", "职业生涯规划", "二", "5-6", "综合楼 · 402"),
      [
        "DEMO07",
        "自主学习课程",
        "",
        "",
        "01",
        "1",
        "选修",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ].map((text) => ({ text, rowSpan: 1, colSpan: 1 })),
    ],
  };
}
export function demoSnapshot() {
  return parseSnapshot(demoRaw());
}
