import { createHash } from "node:crypto";
import { parseHTML } from "linkedom";
import { extractSchoolJSON } from "../core/school-json.ts";
import { normalizeSchoolLoginURL } from "../core/login.ts";
import { COURSE_PATH, SCHOOL_ORIGIN, parseSnapshot } from "../core/model.ts";
import {
  readRememberedLogin,
  setRememberedLogin,
} from "../services/remembered-login.ts";

type Jar = Map<string, string>;

// Matches the school's hex_md5(s): it appends this suffix and hashes 8-bit characters.
const PASSWORD_SUFFIX = "{Urp602019}";
const schoolPaths = new Set([
  "/",
  "/login",
  "/img/captcha.jpg",
  "/j_spring_security_check",
  "/ajax/student/getSectionAndTime",
  "/student/courseSelect/thisSemesterCurriculum/ajaxStudentSchedule/callback",
  COURSE_PATH,
]);

function publicURL(request: Request) {
  const url = new URL(request.url);
  if (request.headers.get("x-forwarded-proto") === "https")
    url.protocol = "https:";
  return url;
}

function json(error: string, status: number, headers = new Headers()) {
  headers.set("Cache-Control", "no-store");
  return Response.json({ error }, { status, headers });
}

async function sessionKey(request: Request) {
  const secret = process.env.SCHOOL_SESSION_KEY;
  if (!secret) {
    if (publicURL(request).protocol === "https:")
      throw new Error("服务端尚未配置学校会话密钥");
    return null;
  }
  if (!/^[a-z\d_-]{43}$/i.test(secret)) throw new Error("学校会话密钥格式无效");
  const bytes = Buffer.from(secret, "base64url");
  if (bytes.length !== 32) throw new Error("学校会话密钥格式无效");
  return crypto.subtle.importKey(
    "raw",
    Uint8Array.from(bytes),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
}

async function readJar(request: Request, name: string): Promise<Jar | null> {
  const value = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  if (!value || value.length > 3000) return null;
  try {
    const key = await sessionKey(request);
    const bytes = Buffer.from(value, "base64url");
    const plain = key
      ? await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: Uint8Array.from(bytes.subarray(0, 12)) },
          key,
          Uint8Array.from(bytes.subarray(12)),
        )
      : bytes;
    const entries: unknown = JSON.parse(new TextDecoder().decode(plain));
    if (
      !Array.isArray(entries) ||
      entries.length > 12 ||
      !entries.every(
        (entry) =>
          Array.isArray(entry) &&
          entry.length === 2 &&
          typeof entry[0] === "string" &&
          /^[a-z\d_.-]{1,80}$/i.test(entry[0]) &&
          typeof entry[1] === "string" &&
          entry[1].length < 1024 &&
          !/[;\r\n]/.test(entry[1]),
      )
    )
      return null;
    return new Map(entries);
  } catch {
    return null;
  }
}

async function setJar(
  headers: Headers,
  name: string,
  jar: Jar | null,
  request: Request,
) {
  const key = await sessionKey(request);
  let value = "";
  if (jar) {
    const plain = Uint8Array.from(Buffer.from(JSON.stringify(Array.from(jar))));
    if (key) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        plain,
      );
      value = Buffer.concat([Buffer.from(iv), Buffer.from(encrypted)]).toString(
        "base64url",
      );
    } else {
      value = Buffer.from(plain).toString("base64url");
    }
  }
  if (value.length > 3000) throw new Error("学校会话响应过大");
  const secure = publicURL(request).protocol === "https:" ? "; Secure" : "";
  const maxAge = name === "cx_active" ? 30 * 24 * 60 * 60 : 2 * 60 * 60;
  headers.append(
    "Set-Cookie",
    `${name}=${value}; HttpOnly; SameSite=Strict; Path=/school; Max-Age=${jar ? maxAge : 0}${secure}`,
  );
}

function sameOrigin(request: Request) {
  return request.headers.get("origin") === publicURL(request).origin;
}

function redirectPath(response: Response) {
  const location = response.headers.get("location");
  if (!location) return null;
  const url = new URL(location, SCHOOL_ORIGIN);
  return url.origin === SCHOOL_ORIGIN ? url.pathname : null;
}

async function schoolFetch(path: string, jar: Jar, body?: URLSearchParams) {
  const url = new URL(path, SCHOOL_ORIGIN);
  if (url.origin !== SCHOOL_ORIGIN || !schoolPaths.has(url.pathname))
    throw new Error("学校地址不在允许范围内");
  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: {
      Cookie: Array.from(jar, ([name, value]) => `${name}=${value}`).join("; "),
      ...(body
        ? {
            "Content-Type": "application/x-www-form-urlencoded",
            Origin: SCHOOL_ORIGIN,
            Referer: `${SCHOOL_ORIGIN}${url.pathname === "/j_spring_security_check" ? "/login" : COURSE_PATH}`,
          }
        : {}),
    },
    body,
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  for (const value of response.headers.getSetCookie()) {
    const pair = value.split(";", 1)[0];
    const offset = pair.indexOf("=");
    if (offset > 0) jar.set(pair.slice(0, offset), pair.slice(offset + 1));
  }
  return response;
}

async function readCourse(jar: Jar) {
  const response = await schoolFetch(COURSE_PATH, jar);
  if (response.status >= 300 && response.status < 400) {
    if (["/login", "/zgsyLogin"].includes(redirectPath(response) ?? ""))
      throw new Error("学校登录已失效，请重新绑定");
    throw new Error("学校课表页发生未适配的跳转");
  }
  if (
    !response.ok ||
    !response.headers.get("content-type")?.includes("text/html")
  )
    throw new Error("学校课表暂时无法读取");
  const html = await response.text();
  if (html.length > 2_000_000) throw new Error("学校课表响应过大");
  const courses = await schoolFetch(
    "/student/courseSelect/thisSemesterCurriculum/ajaxStudentSchedule/callback",
    jar,
  );
  if (!courses.ok || !courses.headers.get("content-type")?.includes("json"))
    throw new Error("学校课程数据暂时无法读取");
  const courseText = await courses.text();
  if (courseText.length > 2_000_000) throw new Error("学校课程数据响应过大");
  let courseData: unknown;
  try {
    courseData = JSON.parse(courseText);
  } catch {
    throw new Error("学校课程数据格式发生变化");
  }
  const section = await schoolFetch(
    "/ajax/student/getSectionAndTime",
    jar,
    new URLSearchParams({ planNumber: "", ff: "f", xqh: "" }),
  );
  if (!section.ok || !section.headers.get("content-type")?.includes("json"))
    throw new Error("学校作息时间暂时无法读取");
  const sectionText = await section.text();
  if (sectionText.length > 100_000) throw new Error("学校作息响应过大");
  let sectionData: { data?: { sectionTime?: unknown } };
  try {
    sectionData = JSON.parse(sectionText);
  } catch {
    throw new Error("学校作息时间格式发生变化");
  }
  const sectionTime = sectionData?.data?.sectionTime;
  if (!Array.isArray(sectionTime)) throw new Error("学校作息时间格式发生变化");
  const periods = sectionTime.map((item) => {
    if (!item || typeof item !== "object")
      throw new Error("学校作息时间格式发生变化");
    const value = item as {
      id?: { session?: number };
      startTime?: string;
      endTime?: string;
    };
    const time = (text?: string) =>
      typeof text === "string" && /^\d{4}$/.test(text)
        ? `${text.slice(0, 2)}:${text.slice(2)}`
        : "";
    return {
      period: Number(value.id?.session),
      start: time(value.startTime),
      end: time(value.endTime),
    };
  });
  const raw = extractSchoolJSON(
    parseHTML(html).document as unknown as Document,
    courseData,
    periods,
  );
  parseSnapshot(raw);
  return raw;
}

export async function GET(request: Request) {
  const action = new URL(request.url).searchParams.get("action");
  if (action === "login-info") {
    const login = readRememberedLogin(request);
    return Response.json(
      {
        login: login
          ? { loginUrl: login.loginUrl, username: login.username }
          : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  if (action === "captcha") {
    try {
      const jar: Jar = new Map();
      const login = await schoolFetch("/login", jar);
      if (!login.ok)
        throw new Error(`学校登录页暂时不可用（HTTP ${login.status}）`);
      const image = await schoolFetch("/img/captcha.jpg", jar);
      if (!image.ok || !image.headers.get("content-type")?.startsWith("image/"))
        throw new Error("学校验证码暂时不可用");
      const bytes = await image.arrayBuffer();
      if (bytes.byteLength > 100_000) throw new Error("学校验证码响应过大");
      const headers = new Headers({
        "Content-Type": image.headers.get("content-type")!,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      await setJar(headers, "cx_pending", jar, request);
      return new Response(bytes, { headers });
    } catch (error) {
      console.error("School captcha failed", error);
      return json("学校验证码暂时无法加载，请稍后重试", 502);
    }
  }
  if (action === "sync") {
    const jar = await readJar(request, "cx_active");
    if (!jar) return json("学校登录已失效，请重新绑定", 401);
    try {
      const raw = await readCourse(jar);
      const headers = new Headers({ "Cache-Control": "no-store" });
      await setJar(headers, "cx_active", jar, request);
      return Response.json({ raw }, { headers });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "学校课表读取失败";
      const headers = new Headers();
      if (message.includes("登录已失效"))
        await setJar(headers, "cx_active", null, request);
      return json(message, message.includes("登录已失效") ? 401 : 502, headers);
    }
  }
  return json("未知操作", 404);
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json("请求来源无效", 403);
  const jar = await readJar(request, "cx_pending");
  if (!jar) return json("请先刷新学校验证码", 400);
  if (Number(request.headers.get("content-length")) > 4096)
    return json("请求内容过长", 413);
  let input: {
    url?: string;
    username?: string;
    password?: string;
    captcha?: string;
    remember?: boolean;
    useSavedLogin?: boolean;
  };
  try {
    const text = await request.text();
    if (text.length > 4096) return json("请求内容过长", 413);
    input = JSON.parse(text);
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new Error("输入格式无效");
    if (input.useSavedLogin !== true) normalizeSchoolLoginURL(input.url ?? "");
  } catch {
    return json("教务网址或输入格式无效", 400);
  }
  const remembered =
    input.useSavedLogin === true ? readRememberedLogin(request) : null;
  if (input.useSavedLogin === true && !remembered)
    return json("保存的登录信息已失效，请重新填写学号和密码", 401);
  const username =
    remembered?.username ??
    (typeof input.username === "string" ? input.username.trim() : "");
  const password =
    remembered?.password ??
    (typeof input.password === "string" ? input.password : "");
  const captcha = typeof input.captcha === "string" ? input.captcha.trim() : "";
  if (
    !username ||
    username.length > 50 ||
    !password ||
    password.length > 50 ||
    !/^[a-z\d]{4,8}$/i.test(captcha)
  )
    return json("请填写有效的学号、密码和验证码", 400);
  const headers = new Headers();
  await setJar(headers, "cx_pending", null, request);
  try {
    const body = new URLSearchParams({
      j_username: username,
      j_password: createHash("md5")
        .update(password + PASSWORD_SUFFIX, "latin1")
        .digest("hex"),
      j_captcha: captcha,
    });
    const login = await schoolFetch("/j_spring_security_check", jar, body);
    if (login.status >= 500) throw new Error("学校登录服务暂时不可用");
    if (login.status >= 300 && login.status < 400) {
      const path = redirectPath(login);
      if (!path) throw new Error("学校登录返回了异常跳转");
      if (["/login", "/zgsyLogin"].includes(path)) {
        const location = new URL(login.headers.get("location")!, SCHOOL_ORIGIN);
        const code = location.searchParams.get("errorCode");
        const detail =
          code && /^[a-z\d_-]{1,40}$/i.test(code) ? `（${code}）` : "";
        throw new Error(`学校未接受本次登录${detail}，请刷新验证码并核对输入`);
      }
      if (path === "/") {
        const landing = await schoolFetch("/", jar);
        if (["/login", "/zgsyLogin"].includes(redirectPath(landing) ?? ""))
          throw new Error("学校未建立登录会话，请刷新验证码后重试");
      }
    } else if (!login.ok) {
      throw new Error("学校未接受本次登录，请稍后重试");
    } else if (login.headers.get("content-type")?.includes("text/html")) {
      const html = await login.text();
      if (html.includes('action="/j_spring_security_check"'))
        throw new Error("学校未接受本次登录，请刷新验证码并核对输入");
    }
    const raw = await readCourse(jar);
    if (input.remember === true || input.useSavedLogin === true)
      setRememberedLogin(
        headers,
        {
          loginUrl: normalizeSchoolLoginURL(
            remembered?.loginUrl ?? input.url ?? "",
          ),
          username,
          password,
        },
        request,
      );
    else setRememberedLogin(headers, null, request);
    await setJar(headers, "cx_active", jar, request);
    headers.set("Cache-Control", "no-store");
    return Response.json({ raw }, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "学校登录失败";
    return json(
      message,
      /未接受|登录已失效|未建立登录会话/.test(message) ? 401 : 502,
      headers,
    );
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return json("请求来源无效", 403);
  const headers = new Headers({ "Cache-Control": "no-store" });
  const action = new URL(request.url).searchParams.get("action");
  if (action !== "forget-login") {
    await setJar(headers, "cx_active", null, request);
    await setJar(headers, "cx_pending", null, request);
  }
  if (action !== "logout") setRememberedLogin(headers, null, request);
  return new Response(null, { status: 204, headers });
}
