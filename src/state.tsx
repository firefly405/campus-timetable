import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Course,
  RawSnapshot,
  Snapshot,
  changesBetween,
  contentKey,
  parseSnapshot,
  requiresVerification,
} from "./core/model";
import { demoRaw } from "./core/demo";
import { normalizeSchoolLoginURL } from "./core/login";
import { DEFAULT_THEME_COLOR, normalizeThemeColor } from "./core/theme";
import {
  askNotifications,
  canClearSession,
  clearSchoolSession,
  replaceReminders,
} from "./services/device";
import { WEB_GATEWAY_HEADERS } from "./services/web-gateway";

const KEY = "campus-timetable-v1";
type LoginDraft = { loginUrl: string; username: string; password: string };
type RememberedLogin = { loginUrl: string; username: string };
type RecordChange = {
  id: string;
  at: string;
  title: string;
  type: string;
  before: string;
  after: string;
  read: boolean;
};
type Saved = {
  version: 1;
  mode: "empty" | "demo" | "school";
  raw: RawSnapshot | null;
  history: RecordChange[];
  remind: boolean;
  minutes: number;
  httpConsent: boolean;
  theme: string;
};
const empty: Saved = {
  version: 1,
  mode: "empty",
  raw: null,
  history: [],
  remind: false,
  minutes: 20,
  httpConsent: false,
  theme: DEFAULT_THEME_COLOR,
};
function describe(c?: Course) {
  return c
    ? `${c.teacher || "教师待定"}\n${c.meetings.map((m) => `第${m.weeks.join("、")}周 周${"一二三四五六日"[m.day - 1]} ${m.start}-${m.end} ${m.room || "地点待定"}`).join("\n") || "尚未安排上课时间"}`
    : "无此课程";
}
type StateContext = {
  saved: Saved;
  snapshot: Snapshot | null;
  ready: boolean;
  status: string;
  busy: boolean;
  requestId: number;
  portalOpen: boolean;
  loginDraft: LoginDraft | null;
  rememberedLogin: RememberedLogin | null;
  pending: Snapshot | null;
  demo: () => void;
  demoChange: () => void;
  sync: () => void;
  accept: (data: unknown, request: number) => void;
  fail: (message: string, request: number) => void;
  bind: (
    url: string,
    username: string,
    password: string,
    captcha?: string,
  ) => Promise<void>;
  quickLogin: (captcha: string) => Promise<void>;
  forgetLogin: () => Promise<void>;
  clearLoginDraft: () => void;
  clear: () => Promise<void>;
  setPortalOpen: (value: boolean) => void;
  markRead: () => void;
  setReminder: (
    enabled: boolean,
    minutes?: number,
  ) => Promise<"system" | "foreground" | "off">;
  setTheme: (theme: string) => void;
};
const Context = createContext<StateContext | null>(null);
async function webSnapshot(response: Response): Promise<RawSnapshot> {
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.raw)
    throw new Error(result?.error || "学校连接失败，请稍后重试");
  return result.raw;
}
export function Store({ children }: { children: React.ReactNode }) {
  const [saved, setSaved] = useState<Saved>(empty),
    [ready, setReady] = useState(false),
    [status, setStatus] = useState("尚未绑定教务系统");
  const [busy, setBusy] = useState(false),
    [requestId, setRequestId] = useState(0),
    [portalOpen, setPortalOpen] = useState(false);
  const [loginDraft, setLoginDraft] = useState<LoginDraft | null>(null);
  const [rememberedLogin, setRememberedLogin] =
    useState<RememberedLogin | null>(null);
  const [pending, setPending] = useState<Snapshot | null>(null);
  const current = useRef(saved);
  current.current = saved;
  const request = useRef(0),
    lastAttempt = useRef(0),
    pendingRef = useRef<Snapshot | null>(null),
    firstBind = useRef(false),
    persistence = useRef(Promise.resolve());
  const snapshot = saved.raw ? parseSnapshot(saved.raw) : null;

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(KEY)
      .then((text) => {
        if (!text || !active) return;
        const data = JSON.parse(text);
        if (
          data.version !== 1 ||
          !["empty", "demo", "school"].includes(data.mode) ||
          typeof data.remind !== "boolean" ||
          typeof data.httpConsent !== "boolean" ||
          ![5, 10, 15, 20, 30, 60].includes(data.minutes) ||
          (data.theme !== undefined && !normalizeThemeColor(data.theme))
        )
          throw new Error("缓存格式无效");
        if (data.raw) parseSnapshot(data.raw);
        if (
          !Array.isArray(data.history) ||
          data.history.length > 200 ||
          !data.history.every(
            (r: RecordChange) =>
              r &&
              ["id", "at", "title", "type", "before", "after"].every(
                (k) => typeof r[k as keyof RecordChange] === "string",
              ) &&
              typeof r.read === "boolean",
          )
        )
          throw new Error("变更缓存格式无效");
        if (active) {
          setSaved({
            ...data,
            theme: normalizeThemeColor(data.theme) ?? DEFAULT_THEME_COLOR,
          });
          setStatus(
            data.mode === "demo"
              ? "演示数据 · 未连接学校"
              : data.raw
                ? "已加载离线课表"
                : "尚未绑定教务系统",
          );
        }
      })
      .catch(() => {
        if (active) setStatus("本地缓存无法读取，请重新绑定或进入演示");
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    persistence.current = persistence.current
      .catch(() => {})
      .then(() => AsyncStorage.setItem(KEY, JSON.stringify(saved)))
      .catch(() => setStatus("本地保存失败，请保留应用并重试"));
  }, [saved, ready]);
  useEffect(() => {
    if (!ready || Platform.OS !== "web") return;
    void fetch("/school?action=login-info", {
      credentials: "same-origin",
      cache: "no-store",
      headers: WEB_GATEWAY_HEADERS,
    })
      .then((response) => response.json())
      .then((result) => {
        const login = result?.login;
        if (
          login &&
          typeof login.username === "string" &&
          normalizeSchoolLoginURL(login.loginUrl)
        )
          setRememberedLogin(login);
      })
      .catch(() => {});
  }, [ready]);
  useEffect(() => {
    if (!ready) return;
    void replaceReminders(
      saved.mode === "school" && saved.raw ? parseSnapshot(saved.raw) : null,
      saved.remind,
      saved.minutes,
    ).catch((e) => setStatus("课表已保留；提醒未更新：" + e.message));
  }, [saved.raw, saved.mode, saved.remind, saved.minutes, ready]);
  function sync() {
    if (current.current.mode !== "school" || portalOpen) return;
    const now = Date.now();
    if (now - lastAttempt.current < 30000) {
      setStatus("请稍后再同步，避免频繁访问学校");
      return;
    }
    lastAttempt.current = now;
    request.current += 1;
    setRequestId(request.current);
    setBusy(true);
    setStatus("正在检查学校课表…");
    if (Platform.OS === "web") {
      const id = request.current;
      void fetch("/school?action=sync", {
        credentials: "same-origin",
        cache: "no-store",
        headers: WEB_GATEWAY_HEADERS,
      })
        .then(webSnapshot)
        .then((raw) => accept(raw, id))
        .catch((error) =>
          fail(
            error instanceof Error
              ? error.message
              : "学校同步失败，保留最近课表",
            id,
          ),
        );
    }
  }
  const syncRef = useRef(sync);
  syncRef.current = sync;
  useEffect(() => {
    if (!ready || saved.mode !== "school" || !canClearSession()) return;
    if (firstBind.current) firstBind.current = false;
    else syncRef.current();
    const subscription = AppState.addEventListener("change", (s) => {
      if (s === "active") syncRef.current();
    });
    const timer = setInterval(
      () => {
        if (AppState.currentState === "active") syncRef.current();
      },
      5 * 60 * 1000,
    );
    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, [ready, saved.mode]);
  useEffect(() => {
    if (!busy) return;
    const id = requestId;
    const timer = setTimeout(() => fail("同步超时，已保留最近课表", id), 35000);
    return () => clearTimeout(timer);
  }, [busy, requestId]);
  function fail(message: string, id: number) {
    if (id === request.current) {
      setStatus(message);
      setBusy(false);
    }
  }
  function accept(input: unknown, id: number) {
    if (id !== request.current || current.current.mode !== "school") return;
    try {
      const raw = {
        ...(input as RawSnapshot),
        capturedAt: new Date().toISOString(),
      };
      const next = parseSnapshot(raw);
      const previous = current.current.raw
        ? parseSnapshot(current.current.raw)
        : null;
      if (previous && requiresVerification(previous, next)) {
        const candidate = pendingRef.current;
        if (
          !candidate ||
          contentKey(candidate) !== contentKey(next) ||
          Date.parse(next.capturedAt) - Date.parse(candidate.capturedAt) < 30000
        ) {
          pendingRef.current = next;
          setPending(next);
          setStatus("发现学期或课程减少，等待下一次同步复核");
          setBusy(false);
          setPortalOpen(false);
          return;
        }
      }
      pendingRef.current = null;
      setPending(null);
      const changes = previous
        ? changesBetween(previous, next).map((c) => ({
            ...c,
            before: describe(c.before),
            after: describe(c.after),
          }))
        : [];
      setSaved((s) => ({
        ...s,
        raw,
        history: [...changes, ...s.history].slice(0, 200),
      }));
      setStatus(
        changes.length
          ? `已更新 ${changes.length} 门课程`
          : "课表已核对，无新增变更",
      );
      setBusy(false);
      setPortalOpen(false);
    } catch (e) {
      fail(e instanceof Error ? e.message : "课表校验失败，保留原数据", id);
    }
  }
  async function clear() {
    request.current++;
    setRequestId(request.current);
    setBusy(false);
    setPortalOpen(false);
    setLoginDraft(null);
    setRememberedLogin(null);
    setSaved({ ...empty, theme: current.current.theme }); // Unmount the WebView before erasing its store.
    pendingRef.current = null;
    setPending(null);
    await new Promise((resolve) => setTimeout(resolve, 50));
    try {
      if (canClearSession()) await clearSchoolSession();
      await replaceReminders(null, false, 15);
    } catch (e) {
      setStatus("本地课表已清除；学校登录状态清理失败，请重试");
      throw e;
    }
    pendingRef.current = null;
    setPending(null);
    setSaved({ ...empty, theme: current.current.theme });
    setStatus("已清除课表、提醒、教务登录状态及保存的账号");
  }
  async function bind(
    url: string,
    username: string,
    password: string,
    captcha = "",
  ) {
    const loginUrl = normalizeSchoolLoginURL(url);
    if (
      !username.trim() ||
      username.length > 100 ||
      !password ||
      password.length > 200
    )
      throw new Error("请填写有效的学号和密码");
    if (Platform.OS === "web") {
      if (!captcha.trim()) throw new Error("请填写学校验证码");
      const response = await fetch("/school", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          ...WEB_GATEWAY_HEADERS,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: loginUrl,
          username,
          password,
          captcha,
          remember: true,
        }),
      });
      const raw = await webSnapshot(response);
      parseSnapshot(raw);
      request.current++;
      setRequestId(request.current);
      setBusy(false);
      setPortalOpen(false);
      setLoginDraft(null);
      pendingRef.current = null;
      setPending(null);
      firstBind.current = true;
      lastAttempt.current = 0;
      setSaved((s) => ({ ...s, mode: "school", raw, httpConsent: true }));
      setRememberedLogin({ loginUrl, username: username.trim() });
      setStatus("已从学校读取本学期课表");
      return;
    }
    if (Platform.OS !== "ios" || !canClearSession())
      throw new Error("此操作需要专用 iOS 开发包；当前可预览演示课表");
    lastAttempt.current = 0;
    firstBind.current = true;
    request.current++;
    setRequestId(request.current);
    setLoginDraft({ loginUrl, username: username.trim(), password });
    setSaved((s) => ({ ...s, mode: "school", httpConsent: true }));
    setPortalOpen(true);
    setStatus("请在学校页面完成登录与验证码");
  }
  async function quickLogin(captcha: string) {
    if (Platform.OS !== "web") throw new Error("快速登录仅用于网页版本");
    if (!rememberedLogin) throw new Error("没有已保存的登录账号");
    if (!/^[a-z\d]{4,8}$/i.test(captcha.trim()))
      throw new Error("请填写有效的学校验证码");
    setBusy(true);
    setStatus("正在使用已保存账号登录学校…");
    try {
      const response = await fetch("/school", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          ...WEB_GATEWAY_HEADERS,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ useSavedLogin: true, captcha }),
      });
      const raw = await webSnapshot(response);
      parseSnapshot(raw);
      request.current++;
      setRequestId(request.current);
      firstBind.current = true;
      lastAttempt.current = 0;
      setSaved((s) => ({ ...s, mode: "school", raw, httpConsent: true }));
      setStatus("一键登录成功，已读取最新课表");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "快速登录失败，请使用学号、密码和验证码重新登录",
      );
      throw error;
    } finally {
      setBusy(false);
    }
  }
  async function forgetLogin() {
    if (Platform.OS !== "web") return;
    const response = await fetch("/school?action=forget-login", {
      method: "DELETE",
      credentials: "same-origin",
      headers: WEB_GATEWAY_HEADERS,
    });
    if (!response.ok) throw new Error("清除已保存账号失败，请稍后重试");
    setRememberedLogin(null);
    setStatus("已清除保存的教务网址、学号和密码；课表继续保留");
  }
  function demo() {
    request.current++;
    setRequestId(request.current);
    setBusy(false);
    setPortalOpen(false);
    setLoginDraft(null);
    pendingRef.current = null;
    setPending(null);
    setSaved({
      ...empty,
      mode: "demo",
      raw: demoRaw(),
      theme: current.current.theme,
    });
    setStatus("演示数据 · 未连接学校");
  }
  function demoChange() {
    setSaved((s) => {
      if (s.mode !== "demo" || !s.raw) return s;
      const raw = JSON.parse(JSON.stringify(s.raw)) as RawSnapshot;
      raw.capturedAt = new Date().toISOString();
      raw.rows[3][13].text = raw.rows[3][13].text.includes("C106")
        ? "实验楼 · C208"
        : "实验楼 · C106";
      const changes = changesBetween(
        parseSnapshot(s.raw),
        parseSnapshot(raw),
      ).map((c) => ({
        ...c,
        before: describe(c.before),
        after: describe(c.after),
      }));
      return { ...s, raw, history: [...changes, ...s.history].slice(0, 200) };
    });
    setStatus("演示：教室变更已更新，可在变更页查看");
  }
  async function setReminder(enabled: boolean, minutes = saved.minutes) {
    if (enabled && saved.mode !== "school")
      throw new Error("绑定真实课表后可开启上课提醒");
    const mode = enabled ? await askNotifications() : "off";
    const nextMinutes = Platform.OS === "web" ? 20 : minutes;
    const activeSnapshot = current.current.raw
      ? parseSnapshot(current.current.raw)
      : null;
    const appliedMode = await replaceReminders(
      activeSnapshot,
      enabled,
      nextMinutes,
    );
    setSaved((s) => ({ ...s, remind: enabled, minutes: nextMinutes }));
    return appliedMode ?? mode;
  }
  return (
    <Context.Provider
      value={{
        saved,
        snapshot,
        ready,
        status,
        busy,
        requestId,
        portalOpen,
        loginDraft,
        rememberedLogin,
        pending,
        demo,
        demoChange,
        sync,
        accept,
        fail,
        bind,
        quickLogin,
        forgetLogin,
        clearLoginDraft: () => setLoginDraft(null),
        clear,
        setPortalOpen,
        markRead: () =>
          setSaved((s) => ({
            ...s,
            history: s.history.map((c) => ({ ...c, read: true })),
          })),
        setReminder,
        setTheme: (theme) => {
          const color = normalizeThemeColor(theme);
          if (color) setSaved((s) => ({ ...s, theme: color }));
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useStore() {
  const value = useContext(Context);
  if (!value) throw new Error("缺少课表状态");
  return value;
}
