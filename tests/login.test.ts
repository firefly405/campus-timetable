import test from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import {
  loginFillScript,
  normalizeSchoolLoginURL,
  SCHOOL_LOGIN_URL,
  supportsSchoolLoginURL,
} from "../src/core/login.ts";

test("only the verified school login URL can receive credentials", () => {
  assert.equal(normalizeSchoolLoginURL(SCHOOL_LOGIN_URL), SCHOOL_LOGIN_URL);
  assert.equal(
    normalizeSchoolLoginURL(" http://202.114.190.75/ "),
    SCHOOL_LOGIN_URL,
  );
  for (const url of [
    "https://202.114.190.75/login",
    "http://202.114.190.75.evil.invalid/login",
    "http://user:password@202.114.190.75/login",
    "http://202.114.190.75/student/courseSelect/quitCourse/index",
    "http://202.114.190.75/login?next=https://evil.invalid",
  ])
    assert.throws(() => normalizeSchoolLoginURL(url));
});

test("unsupported school URLs are identified before loading a captcha", () => {
  assert.equal(supportsSchoolLoginURL(SCHOOL_LOGIN_URL), true);
  assert.equal(supportsSchoolLoginURL("https://jw.example.edu.cn/login"), false);
  assert.equal(supportsSchoolLoginURL("not a url"), false);
});

test("fills the school's form without submitting or sending credentials to the bridge", () => {
  const { document, window } = parseHTML(
    '<form action="/j_spring_security_check"><input id="input_username"><input id="input_password" type="password"><input id="input_checkcode"><button type="submit">登录</button></form>',
  );
  const messages: string[] = [];
  const username = 'student";notCode()//';
  const password = "secret\\n\\";
  const run = new Function(
    "document",
    "location",
    "window",
    "Event",
    loginFillScript(username, password),
  );
  run(
    document,
    { origin: "http://202.114.190.75", pathname: "/login" },
    {
      ReactNativeWebView: {
        postMessage: (data: string) => messages.push(data),
      },
    },
    window.Event,
  );
  assert.equal(
    document.querySelector<HTMLInputElement>("#input_username")?.value,
    username,
  );
  assert.equal(
    document.querySelector<HTMLInputElement>("#input_password")?.value,
    password,
  );
  assert.equal(
    document.querySelector<HTMLInputElement>("#input_checkcode")?.value,
    "",
  );
  assert.deepEqual(messages, []);
});

test("never fills a form on another origin and reports changed school forms without credentials", () => {
  const { document, window } = parseHTML(
    '<form action="/j_spring_security_check"><input id="input_username"><input id="input_password"></form>',
  );
  const messages: string[] = [];
  const run = new Function(
    "document",
    "location",
    "window",
    "Event",
    loginFillScript("TEST_USER", "TEST_PASSWORD"),
  );
  const bridge = {
    ReactNativeWebView: { postMessage: (data: string) => messages.push(data) },
  };
  run(
    document,
    { origin: "https://evil.invalid", pathname: "/login" },
    bridge,
    window.Event,
  );
  assert.equal(
    document.querySelector<HTMLInputElement>("#input_username")?.value,
    "",
  );
  document.querySelector("#input_password")?.remove();
  run(
    document,
    { origin: "http://202.114.190.75", pathname: "/login" },
    bridge,
    window.Event,
  );
  assert.deepEqual(messages, ['{"type":"login-form-error"}']);
  assert.equal(messages.join("").includes("TEST_PASSWORD"), false);
});
