import test from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import { extractSchoolJSON } from "../src/core/school-json.ts";
import { parseSnapshot } from "../src/core/model.ts";

const doc = parseHTML("<a>2026-2027 秋季 第7周 星期四</a>")
  .document as unknown as Document;
const periods = [
  { period: 1, start: "08:20", end: "09:05" },
  { period: 2, start: "09:10", end: "09:55" },
];

test("school JSON yields scheduled and unscheduled courses without rendered HTML", () => {
  const data = {
    csz: "1",
    dateList: [
      {
        selectCourseList: [
          {
            id: { coureNumber: "TEST01", coureSequenceNumber: "01" },
            courseName: "虚构课程",
            unit: 2,
            attendClassTeacher: "示例教师*",
            timeAndPlaceList: [
              {
                coureNumber: "TEST01",
                coureSequenceNumber: "01",
                weekDescription: "第7周",
                classDay: 1,
                classSessions: 1,
                continuingSession: 2,
                campusName: "南区",
                teachingBuildingName: "教学楼",
                classroomName: "A201",
              },
            ],
          },
          {
            id: { coureNumber: "TEST02", coureSequenceNumber: "02" },
            courseName: "虚构未排课",
            timeAndPlaceList: [],
          },
        ],
      },
    ],
  };
  const snapshot = parseSnapshot(extractSchoolJSON(doc, data, periods));
  assert.equal(snapshot.courses.length, 2);
  assert.equal(snapshot.courses[0].meetings.length, 1);
  assert.equal(snapshot.courses[1].meetings.length, 0);
});

test("incomplete school JSON is rejected before replacing a timetable", () => {
  assert.throws(() =>
    extractSchoolJSON(doc, { csz: "0", dateList: [] }, periods),
  );
  assert.throws(() =>
    parseSnapshot(
      extractSchoolJSON(doc, { csz: "1", dateList: [{}] }, periods),
    ),
  );
});
