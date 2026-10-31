import test from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import { extractCourseDOM, bridgeScript } from "../src/core/extractor.ts";
import { HEADERS, parseSnapshot } from "../src/core/model.ts";

function fixture() {
  return parseHTML(`<html><body>
<input name="j_password" value="DO_NOT_READ_PASSWORD"><a>2026-2027 秋季 第7周 星期四</a>
<table id="courseTable"><tbody><tr><th>第一节(08:20-09:05)</th></tr><tr><th>第二节(09:10-09:55)</th></tr></tbody></table>
<table><thead><tr>${HEADERS.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>
<tr>${["TEST01", "虚构课程", "", "", "01", "2", "必修", "普通课", "", "示例教师", "正常", "置入"].map((t) => `<td rowspan="2">${t}</td>`).join("")}<td>1-8周&gt;&gt;星期一&gt;&gt;1-2节</td><td>教学楼&gt;&gt;A201</td></tr>
<tr><td>9-18周&gt;&gt;星期四&gt;&gt;1-2节</td><td>教学楼&gt;&gt;B202</td></tr>
</tbody></table></body></html>`).document;
}
test("rendered DOM can be converted to normalized courses without password data", () => {
  const doc = fixture();
  Object.defineProperty(doc, "cookie", {
    get() {
      throw new Error("Cookie must not be read");
    },
  });
  const raw = extractCourseDOM(doc as unknown as Document);
  assert.ok(raw);
  assert.equal(raw.rows.length, 2);
  assert.equal(raw.rows[0][0].rowSpan, 2);
  assert.equal(JSON.stringify(raw).includes("DO_NOT_READ_PASSWORD"), false);
  const normalized = parseSnapshot(raw);
  assert.equal(normalized.courses.length, 1);
  assert.equal(normalized.courses[0].meetings.length, 2);
});
test("login pages and duplicate candidate tables are not accepted as a complete timetable", () => {
  const login = parseHTML(
    '<html><body><input type="password"></body></html>',
  ).document;
  assert.equal(extractCourseDOM(login as unknown as Document), null);
  const doc = fixture();
  const table = doc.querySelectorAll("table")[1];
  doc.body.appendChild(table.cloneNode(true));
  assert.equal(extractCourseDOM(doc as unknown as Document), null);
});
test("serialized WebView bridge waits for stable rows and emits exactly the requested ID", () => {
  const doc = fixture();
  const messages: string[] = [];
  const callbacks: (() => void)[] = [];
  const run = new Function(
    "document",
    "window",
    "setTimeout",
    bridgeScript(42),
  );
  run(
    doc,
    {
      ReactNativeWebView: {
        postMessage: (data: string) => messages.push(data),
      },
    },
    (fn: () => void) => callbacks.push(fn),
  );
  assert.equal(messages.length, 0);
  while (callbacks.length) callbacks.shift()!();
  assert.equal(messages.length, 1);
  const result = JSON.parse(messages[0]);
  assert.equal(result.requestId, 42);
  assert.equal(result.data.source, "urp-dom-v1");
  assert.equal(parseSnapshot(result.data).courses.length, 1);
});
