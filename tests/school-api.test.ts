import test from "node:test";
import assert from "node:assert/strict";
import { DELETE, GET, POST } from "../src/app/school+api.ts";
import {
  COURSE_PATH,
  SCHOOL_ORIGIN,
  parseSnapshot,
} from "../src/core/model.ts";

const origin = "http://localhost:8087";
const page = "<html><body><a>2026-2027 秋季 第7周 星期四</a></body></html>";
const courseData = {
  csz: "1",
  dateList: [
    {
      selectCourseList: [
        {
          id: { coureNumber: "TEST01", coureSequenceNumber: "01" },
          courseName: "虚构课程",
          unit: 2,
          attendClassTeacher: "示例教师",
          timeAndPlaceList: [
            {
              coureNumber: "TEST01",
              coureSequenceNumber: "01",
              weekDescription: "1-8周",
              classDay: 1,
              classSessions: 1,
              continuingSession: 2,
              campusName: "教学楼",
              classroomName: "A201",
            },
          ],
        },
      ],
    },
  ],
};

test("web binding carries only a scoped school session through captcha, login and sync", async () => {
  const originalFetch = globalThis.fetch;
  const previousKey = process.env.SCHOOL_SESSION_KEY;
  process.env.SCHOOL_SESSION_KEY = Buffer.alloc(32, 7).toString("base64url");
  const hostedOrigin = "https://campus-test.expo.app";
  let postedBody = "";
  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    assert.ok(url.startsWith(SCHOOL_ORIGIN));
    if (url.endsWith("/login"))
      return new Response("<form></form>", {
        headers: {
          "Content-Type": "text/html",
          "Set-Cookie": "route=demo-route; Path=/",
        },
      });
    if (url.endsWith("/img/captcha.jpg"))
      return new Response(new Uint8Array([1, 2, 3]), {
        headers: {
          "Content-Type": "image/jpeg",
          "Set-Cookie": "student.urpSoft.cn=demo-session; Path=/",
        },
      });
    if (url.endsWith("/j_spring_security_check")) {
      postedBody = String(init?.body);
      assert.match(
        String(init?.headers && JSON.stringify(init.headers)),
        /demo-session/,
      );
      assert.equal(
        (init?.headers as Record<string, string>).Origin,
        SCHOOL_ORIGIN,
      );
      assert.equal(
        (init?.headers as Record<string, string>).Referer,
        `${SCHOOL_ORIGIN}/login`,
      );
      return new Response(null, { status: 302, headers: { Location: "/" } });
    }
    if (url === `${SCHOOL_ORIGIN}/`)
      return new Response("home", {
        headers: { "Set-Cookie": "authenticated=yes; Path=/" },
      });
    if (url.endsWith(COURSE_PATH)) {
      assert.match(JSON.stringify(init?.headers), /authenticated=yes/);
      return new Response(page, { headers: { "Content-Type": "text/html" } });
    }
    if (url.endsWith("/ajaxStudentSchedule/callback"))
      return Response.json(courseData);
    if (url.endsWith("/ajax/student/getSectionAndTime")) {
      assert.equal(String(init?.body), "planNumber=&ff=f&xqh=");
      assert.equal(
        (init?.headers as Record<string, string>).Referer,
        `${SCHOOL_ORIGIN}${COURSE_PATH}`,
      );
      return Response.json({
        data: {
          sectionTime: [
            { id: { session: 1 }, startTime: "0820", endTime: "0905" },
            { id: { session: 2 }, startTime: "0910", endTime: "0955" },
          ],
        },
      });
    }
    throw new Error("Unexpected school URL");
  }) as typeof fetch;

  try {
    const captcha = await GET(
      new Request(`${hostedOrigin}/school?action=captcha`),
    );
    assert.equal(captcha.status, 200);
    assert.equal((await captcha.arrayBuffer()).byteLength, 3);
    const pending = captcha.headers.getSetCookie()[0];
    assert.match(
      pending,
      /cx_pending=.*HttpOnly; SameSite=Strict; Path=\/school; Max-Age=7200; Secure/,
    );
    assert.equal(pending.includes("demo-session"), false);
    const pendingPair = pending.split(";")[0];
    const proxiedOrigin = new URL(hostedOrigin);
    proxiedOrigin.protocol = "http:";
    const proxiedHeaders = { "X-Forwarded-Proto": "https" };
    const proxiedCaptcha = await GET(
      new Request(`${proxiedOrigin.origin}/school?action=captcha`, {
        headers: proxiedHeaders,
      }),
    );
    assert.equal(proxiedCaptcha.status, 200);
    assert.match(proxiedCaptcha.headers.getSetCookie()[0], /; Secure$/);
    const proxiedPost = await POST(
      new Request(`${proxiedOrigin.origin}/school`, {
        method: "POST",
        headers: {
          ...proxiedHeaders,
          Origin: hostedOrigin,
          Cookie: proxiedCaptcha.headers.getSetCookie()[0].split(";")[0],
        },
        body: JSON.stringify({ url: `${SCHOOL_ORIGIN}/login` }),
      }),
    );
    assert.equal(proxiedPost.status, 400);
    const request = (requestOrigin: string) =>
      new Request(`${hostedOrigin}/school`, {
        method: "POST",
        headers: {
          Origin: requestOrigin,
          Cookie: pendingPair,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: `${SCHOOL_ORIGIN}/login`,
          username: "TEST0001",
          password: "not-real-password",
          captcha: "AB12",
          remember: true,
        }),
      });
    assert.equal((await POST(request("http://elsewhere.invalid"))).status, 403);
    const bound = await POST(request(hostedOrigin));
    assert.equal(bound.status, 200);
    const loginBody = new URLSearchParams(postedBody);
    assert.equal(loginBody.get("j_username"), "TEST0001");
    assert.equal(
      loginBody.get("j_password"),
      "a743be05a29ada23a5a6d1e5c3318f04",
    );
    assert.equal(loginBody.get("j_captcha"), "AB12");
    const active = bound.headers
      .getSetCookie()
      .find((value) => value.startsWith("cx_active="));
    assert.ok(active);
    assert.match(active, /Max-Age=2592000/);
    const remembered = bound.headers
      .getSetCookie()
      .find((value) => value.startsWith("cx_login="));
    assert.ok(remembered);
    assert.match(
      remembered,
      /HttpOnly; SameSite=Strict; Path=\/school; Max-Age=15552000; Secure/,
    );
    assert.equal(remembered.includes("not-real-password"), false);
    const loginInfo = await GET(
      new Request(`${hostedOrigin}/school?action=login-info`, {
        headers: { Cookie: remembered.split(";")[0] },
      }),
    );
    assert.deepEqual(await loginInfo.json(), {
      login: { loginUrl: `${SCHOOL_ORIGIN}/login`, username: "TEST0001" },
    });
    const raw = (await bound.json()).raw;
    assert.equal(parseSnapshot(raw).courses.length, 1);
    const sync = await GET(
      new Request(`${hostedOrigin}/school?action=sync`, {
        headers: { Cookie: active.split(";")[0] },
      }),
    );
    assert.equal(sync.status, 200);
    assert.match(
      sync.headers
        .getSetCookie()
        .find((value) => value.startsWith("cx_active=")) ?? "",
      /Max-Age=2592000/,
    );
    assert.equal(parseSnapshot((await sync.json()).raw).courses.length, 1);
    const nextCaptcha = await GET(
      new Request(`${hostedOrigin}/school?action=captcha`),
    );
    const quick = await POST(
      new Request(`${hostedOrigin}/school`, {
        method: "POST",
        headers: {
          Origin: hostedOrigin,
          Cookie: `${nextCaptcha.headers.getSetCookie()[0].split(";")[0]}; ${remembered.split(";")[0]}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ useSavedLogin: true, captcha: "CD34" }),
      }),
    );
    assert.equal(quick.status, 200);
    const quickBody = new URLSearchParams(postedBody);
    assert.equal(quickBody.get("j_username"), "TEST0001");
    assert.equal(quickBody.get("j_captcha"), "CD34");
    assert.equal(
      quickBody.get("j_password"),
      "a743be05a29ada23a5a6d1e5c3318f04",
    );
    const activePair = active.split(";")[0];
    const tamperedPair = activePair.replace(/^(cx_active=.)/, (match) =>
      match.endsWith("A") ? "cx_active=B" : "cx_active=A",
    );
    const tampered = await GET(
      new Request(`${hostedOrigin}/school?action=sync`, {
        headers: { Cookie: tamperedPair },
      }),
    );
    assert.equal(tampered.status, 401);
    const cleared = await DELETE(
      new Request(`${hostedOrigin}/school`, {
        method: "DELETE",
        headers: { Origin: hostedOrigin, Cookie: active.split(";")[0] },
      }),
    );
    assert.equal(cleared.status, 204);
    assert.equal(cleared.headers.getSetCookie().length, 3);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.SCHOOL_SESSION_KEY;
    else process.env.SCHOOL_SESSION_KEY = previousKey;
  }
});

test("web binding distinguishes rejected login from an unreadable timetable", async () => {
  const originalFetch = globalThis.fetch;
  let rejectLogin = true;
  globalThis.fetch = (async (input) => {
    const url = String(input);
    if (url.endsWith("/login"))
      return new Response("login", {
        headers: { "Set-Cookie": "route=test; Path=/" },
      });
    if (url.endsWith("/img/captcha.jpg"))
      return new Response(new Uint8Array([1]), {
        headers: { "Content-Type": "image/jpeg" },
      });
    if (url.endsWith("/j_spring_security_check"))
      return new Response(null, {
        status: 302,
        headers: {
          Location: rejectLogin ? "/login?errorCode=badCredentials" : "/",
        },
      });
    if (url === `${SCHOOL_ORIGIN}/`) return new Response("home");
    if (url.endsWith(COURSE_PATH))
      return new Response(page, {
        headers: { "Content-Type": "text/html" },
      });
    if (url.endsWith("/ajaxStudentSchedule/callback"))
      return Response.json({ csz: "1", dateList: [] });
    if (url.endsWith("/ajax/student/getSectionAndTime"))
      return Response.json({
        data: {
          sectionTime: [
            { id: { session: 1 }, startTime: "0820", endTime: "0905" },
          ],
        },
      });
    throw new Error("Unexpected school URL");
  }) as typeof fetch;
  try {
    async function bind() {
      const captcha = await GET(new Request(`${origin}/school?action=captcha`));
      return POST(
        new Request(`${origin}/school`, {
          method: "POST",
          headers: {
            Origin: origin,
            Cookie: captcha.headers.getSetCookie()[0].split(";")[0],
          },
          body: JSON.stringify({
            url: `${SCHOOL_ORIGIN}/login`,
            username: "TEST0001",
            password: "not-real-password",
            captcha: "AB12",
          }),
        }),
      );
    }
    const rejected = await bind();
    assert.equal(rejected.status, 401);
    assert.match(
      (await rejected.json()).error,
      /学校未接受本次登录（badCredentials）/,
    );
    rejectLogin = false;
    const unreadable = await bind();
    assert.equal(unreadable.status, 502);
    assert.match((await unreadable.json()).error, /未取得完整课表/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
