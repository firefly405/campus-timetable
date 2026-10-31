import { HEADERS, type Cell, type Period, type RawSnapshot } from "./model.ts";

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("学校课程数据格式发生变化");
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  throw new Error("学校课程数据格式发生变化");
}

export function extractSchoolJSON(
  doc: Document,
  payload: unknown,
  periods: Period[],
): RawSnapshot {
  const banner = Array.from(doc.querySelectorAll("a"))
    .map((a) => a.textContent ?? "")
    .find((value) => /\d{4}-\d{4}.+第\s*\d+\s*周/.test(value));
  const term = banner?.match(/(\d{4}-\d{4}\s*.+?)\s*第\s*(\d+)\s*周/);
  if (!term) throw new Error("学校学期信息暂时无法读取");

  const data = record(payload);
  if (text(data.csz) !== "1" || !Array.isArray(data.dateList))
    throw new Error("学校课程数据格式发生变化");
  const rows: Cell[][] = [];
  for (const item of data.dateList) {
    const plan = record(item);
    if (plan.selectCourseList == null) continue;
    if (!Array.isArray(plan.selectCourseList))
      throw new Error("学校课程数据格式发生变化");
    for (const entry of plan.selectCourseList) {
      const course = record(entry);
      const id = record(course.id);
      const code = text(id.coureNumber);
      const sequence = text(id.coureSequenceNumber);
      const group =
        sequence +
        (course.zkxh == null ? "" : `（主课序号：${text(course.zkxh)}）`);
      const common = [
        code,
        text(course.courseName),
        "",
        "",
        group,
        text(course.unit),
        text(course.coursePropertiesName),
        text(course.courseCategoryName),
        text(course.examTypeName),
        text(course.attendClassTeacher),
        text(course.studyModeName),
        text(course.selectCourseStatusName),
      ];
      const places =
        course.timeAndPlaceList == null ? [] : course.timeAndPlaceList;
      if (!Array.isArray(places)) throw new Error("学校课程数据格式发生变化");
      const matches = places
        .map(record)
        .filter(
          (place) =>
            text(place.coureNumber) === code &&
            text(place.coureSequenceNumber) === sequence,
        );
      for (const place of matches.length ? matches : [null]) {
        let time = "",
          room = "";
        if (place) {
          const day = Number(place.classDay);
          const session = Number(place.classSessions);
          const count =
            place.continuingSession == null
              ? 1
              : Number(place.continuingSession);
          if (
            !Number.isInteger(day) ||
            day < 1 ||
            day > 7 ||
            !Number.isInteger(session) ||
            session < 1 ||
            session > 24 ||
            !Number.isInteger(count) ||
            count < 1 ||
            session + count - 1 > 24
          )
            throw new Error("学校课程时间格式发生变化");
          const section =
            count > 1 ? `${session}-${session + count - 1}节` : `${session}节`;
          time = `${text(place.weekDescription)}>>星期${"一二三四五六日"[day - 1]}>>${section}`;
          room = [
            place.campusName,
            place.teachingBuildingName,
            place.classroomName,
          ]
            .map(text)
            .join(">>");
        }
        rows.push(
          [...common, time, room].map((value) => ({
            text: value,
            rowSpan: 1,
            colSpan: 1,
          })),
        );
      }
    }
  }
  return {
    source: "urp-dom-v1",
    term: term[1].trim(),
    currentWeek: Number(term[2]),
    capturedAt: new Date().toISOString(),
    headers: HEADERS,
    rows,
    periods,
  };
}
