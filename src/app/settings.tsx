import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Text,
  TextInput,
  View,
  Switch,
  Platform,
  Pressable,
} from "react-native";
import Constants from "expo-constants";
import { useStore } from "../state";
import { SCHOOL } from "../core/model";
import { SCHOOL_LOGIN_URL, supportsSchoolLoginURL } from "../core/login";
import { THEMES } from "../core/theme";
import ThemeColorPicker from "../components/ThemeColorPicker";
import { webReminderMode, type ReminderMode } from "../services/device";
import { WEB_GATEWAY_HEADERS } from "../services/web-gateway";
import {
  Button,
  Caption,
  Card,
  Heading,
  Screen,
  Section,
  usePalette,
} from "../components/ui";

function SchoolCaptcha({
  version,
  backgroundColor,
  reportError,
}: {
  version: number;
  backgroundColor: string;
  reportError: (message: string) => void;
}) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;
    void fetch(`/school?action=captcha&v=${version}`, {
      credentials: "same-origin",
      cache: "no-store",
      headers: WEB_GATEWAY_HEADERS,
      signal: controller.signal,
    })
      .then(async (response) => {
        if (
          !response.ok ||
          !response.headers.get("content-type")?.startsWith("image/")
        )
          throw new Error("Invalid captcha response");
        return response.blob();
      })
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setUri(objectUrl);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          reportError("验证码加载失败，请检查学校连接后重试");
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [reportError, version]);

  return (
    <View
      style={{
        width: 120,
        height: 45,
        backgroundColor,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {uri ? (
        <Image
          accessibilityLabel="学校验证码图片"
          source={{ uri }}
          resizeMode="contain"
          style={{ width: 120, height: 45 }}
          onError={() => reportError("验证码图片显示失败，请换一张重试")}
        />
      ) : (
        <ActivityIndicator accessibilityLabel="正在加载学校验证码" />
      )}
    </View>
  );
}

export default function Settings() {
  const s = useStore(),
    c = usePalette(),
    [confirm, setConfirm] = useState<"bind" | "quick" | "clear" | null>(null),
    [message, setMessage] = useState(""),
    [working, setWorking] = useState(false),
    [schoolUrl, setSchoolUrl] = useState(SCHOOL_LOGIN_URL),
    [studentId, setStudentId] = useState(""),
    [password, setPassword] = useState(""),
    [captcha, setCaptcha] = useState(""),
    [captchaKey, setCaptchaKey] = useState(0),
    [reminderMode, setReminderMode] = useState<ReminderMode>(() =>
      Platform.OS === "web" ? webReminderMode() : "system",
    );
  const web = Platform.OS === "web";
  const supportedSchool = !web || supportsSchoolLoginURL(schoolUrl);
  function refreshCaptcha() {
    setCaptcha("");
    setMessage("");
    setCaptchaKey((key) => key + 1);
  }
  const fieldStyle = {
    minHeight: 48,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 8,
    backgroundColor: c.card,
    color: c.text,
    fontSize: 15,
    paddingHorizontal: 12,
  };
  async function action<T>(fn: () => Promise<T>) {
    setWorking(true);
    setMessage("");
    try {
      await fn();
      setConfirm(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "操作失败，请重试");
    } finally {
      setWorking(false);
    }
  }
  const allowHttp = Constants.expoConfig?.extra?.allowSchoolHttp === true;
  return (
    <Screen>
      <Heading
        eyebrow="ACCOUNT & PREFERENCES"
        title="我的课表"
        subtitle="课序 · 早期开发版本 0.1.0"
      />
      <Card>
        <Text style={{ color: c.text, fontSize: 19, fontWeight: "700" }}>
          {SCHOOL}
        </Text>
        <Caption>
          {s.saved.mode === "school"
            ? s.saved.raw
              ? "已连接学生教务"
              : "等待学校登录和首次课表同步"
            : s.saved.mode === "demo"
              ? "当前使用虚构演示数据"
              : "尚未绑定学生教务"}
        </Caption>
        <Caption>{s.status}</Caption>
        <Button
          label={
            s.saved.mode === "school" ? "重新登录 / 更换账号" : "绑定学生教务"
          }
          disabled={working}
          onPress={() => {
            setMessage("");
            setConfirm("bind");
            if (web) refreshCaptcha();
          }}
        />
        {web && s.rememberedLogin && (
          <Button
            label={working || s.busy ? "正在登录…" : "使用已保存账号一键登录"}
            secondary
            disabled={working || s.busy}
            onPress={() => {
              setConfirm("quick");
              refreshCaptcha();
            }}
          />
        )}
        {web && s.rememberedLogin && (
          <Caption>
            已保存账号：{s.rememberedLogin.username}
            。只需填写验证码即可重新登录。
          </Caption>
        )}
        {s.saved.mode === "school" && !web && (
          <Button
            label="打开学校登录页"
            secondary
            onPress={() => s.setPortalOpen(true)}
          />
        )}
      </Card>
      {confirm === "quick" && s.rememberedLogin && (
        <View style={{ marginTop: 14 }}>
          <Card>
            <Text style={{ color: c.text, fontWeight: "700" }}>一键登录</Text>
            <Caption>
              使用已加密保存的教务网址、学号和密码。请输入学校验证码。
            </Caption>
            <SchoolCaptcha
              key={captchaKey}
              version={captchaKey}
              backgroundColor={c.soft}
              reportError={setMessage}
            />
            <Button label="换一张验证码" secondary onPress={refreshCaptcha} />
            <TextInput
              accessibilityLabel="学校验证码"
              value={captcha}
              onChangeText={setCaptcha}
              style={fieldStyle}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={8}
            />
            <Button
              label={working || s.busy ? "正在登录…" : "一键登录"}
              disabled={working || s.busy}
              onPress={() =>
                void action(async () => {
                  try {
                    await s.quickLogin(captcha);
                    setCaptcha("");
                  } catch (error) {
                    refreshCaptcha();
                    throw error;
                  }
                })
              }
            />
            {!!message && (
              <Text
                accessibilityRole="alert"
                style={{ color: c.warning, lineHeight: 23 }}
              >
                {message}
              </Text>
            )}
            <Button
              label="忘记已保存账号"
              secondary
              disabled={working}
              onPress={() => void action(s.forgetLogin)}
            />
            <Button
              label="取消"
              secondary
              onPress={() => {
                setCaptcha("");
                setMessage("");
                setConfirm(null);
              }}
            />
          </Card>
        </View>
      )}
      <Section title="背景主题色" />
      <Card>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {THEMES.map((theme) => {
            const selected = s.saved.theme === theme.swatch;
            return (
              <Pressable
                key={theme.id}
                accessibilityRole="button"
                accessibilityLabel={`使用${theme.label}主题`}
                accessibilityState={{ selected }}
                onPress={() => s.setTheme(theme.swatch)}
                style={({ pressed }) => ({
                  width: 84,
                  minHeight: 76,
                  borderRadius: 8,
                  borderWidth: selected ? 3 : 1,
                  borderColor: selected ? c.text : c.line,
                  backgroundColor: c.card,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    backgroundColor: theme.swatch,
                  }}
                />
                <Text style={{ color: c.text, fontSize: 13 }}>
                  {theme.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: c.text, fontWeight: "600" }}>自定义颜色</Text>
            <Caption>{s.saved.theme}</Caption>
          </View>
          <ThemeColorPicker
            key={s.saved.theme}
            value={s.saved.theme}
            onChange={s.setTheme}
          />
        </View>
        <Caption>
          页面背景、卡片、导航栏和按钮会随所选颜色变化，并保存在当前浏览器。
        </Caption>
      </Card>
      {confirm === "bind" && (
        <View style={{ marginTop: 14 }}>
          <Card>
            <Text style={{ color: c.text, fontWeight: "700" }}>绑定说明</Text>
            <Caption>
              学校当前提供 HTTP 入口，传输不受 HTTPS
              保护。请确认这是学校指定入口，仅在可信网络下使用。App
              仅读取你的课程，不修改选课记录。
            </Caption>
            <Caption>
              {web
                ? "登录完成前会继续显示最后一次成功同步的课表。成功后更新课表，并加密保存教务网址、学号和密码，以便下次只填写验证码即可登录。"
                : "重新登录期间会继续显示最后一次成功同步的课表。密码只用于本次填入学校登录页，不会保存在本机课表中；验证码需在学校页面完成。"}
            </Caption>
            {web && (
              <Caption>
                网页会把学号、密码和验证码发送到本站服务器，再由服务器登录学校。公网
                HTTPS 地址可保护你与本站之间的传输，但学校入口仍是
                HTTP，本站到学校的传输不加密；局域网 HTTP
                地址连第一段也不加密。学校会话保存在本站的 HttpOnly Cookie
                中；保存的登录信息经过加密，并放在网页脚本无法读取的 HttpOnly
                Cookie 中。
              </Caption>
            )}
            <Text style={{ color: c.text, fontWeight: "600" }}>教务网址</Text>
            <TextInput
              accessibilityLabel="教务网址"
              value={schoolUrl}
              onChangeText={setSchoolUrl}
              style={fieldStyle}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <Text style={{ color: c.text, fontWeight: "600" }}>学号</Text>
            <TextInput
              accessibilityLabel="学号"
              value={studentId}
              onChangeText={setStudentId}
              style={fieldStyle}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={{ color: c.text, fontWeight: "600" }}>密码</Text>
            <TextInput
              accessibilityLabel="密码"
              value={password}
              onChangeText={setPassword}
              style={fieldStyle}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            {web &&
              (supportedSchool ? (
                <>
                  <Text style={{ color: c.text, fontWeight: "600" }}>
                    学校验证码
                  </Text>
                  <SchoolCaptcha
                    key={captchaKey}
                    version={captchaKey}
                    backgroundColor={c.soft}
                    reportError={setMessage}
                  />
                  <Button
                    label="换一张验证码"
                    secondary
                    onPress={refreshCaptcha}
                  />
                  <TextInput
                    accessibilityLabel="学校验证码"
                    value={captcha}
                    onChangeText={setCaptcha}
                    style={fieldStyle}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={8}
                  />
                </>
              ) : (
                <Text
                  accessibilityRole="alert"
                  style={{ color: c.warning, lineHeight: 23 }}
                >
                  该教务网址尚未适配。不同学校的验证码、登录加密和课表接口不同，暂时不能直接绑定。
                </Text>
              ))}
            {Platform.OS === "ios" && !allowHttp && (
              <Caption>
                当前构建未开启 HTTP 教务接入。需要使用已明确允许该入口的专用 iOS
                测试构建。
              </Caption>
            )}
            <Button
              label={web ? "验证并绑定" : "前往学校验证并绑定"}
              disabled={working || !supportedSchool}
              onPress={() => {
                if (web) {
                  void action(async () => {
                    try {
                      await s.bind(schoolUrl, studentId, password, captcha);
                      setStudentId("");
                      setPassword("");
                      setCaptcha("");
                    } catch (error) {
                      refreshCaptcha();
                      throw error;
                    }
                  });
                  return;
                }
                if (!allowHttp) {
                  setMessage(
                    "当前 iOS 构建未开启学校 HTTP 入口，请使用专用测试构建。",
                  );
                  return;
                }
                const username = studentId;
                const secret = password;
                void action(async () => {
                  await s.bind(schoolUrl, username, secret);
                  setStudentId("");
                  setPassword("");
                });
              }}
            />
            {!!message && (
              <Text
                accessibilityRole="alert"
                style={{ color: c.warning, lineHeight: 23 }}
              >
                {message}
              </Text>
            )}
            <Button
              label="暂不绑定"
              secondary
              onPress={() => {
                setStudentId("");
                setPassword("");
                setCaptcha("");
                setMessage("");
                setConfirm(null);
              }}
            />
          </Card>
        </View>
      )}
      {!!message && confirm !== "bind" && (
        <Text
          accessibilityRole="alert"
          style={{ color: c.warning, marginTop: 14, lineHeight: 23 }}
        >
          {message}
        </Text>
      )}
      <Section title="上课提醒" />
      <Card>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text style={{ color: c.text, fontSize: 16 }}>上课前提醒</Text>
          <Switch
            accessibilityLabel="上课前提醒"
            value={s.saved.remind}
            onValueChange={(value) =>
              void action(async () => {
                const mode = await s.setReminder(value, web ? 20 : undefined);
                if (mode !== "off") setReminderMode(mode);
                setMessage(
                  !value
                    ? "上课提醒已关闭"
                    : mode === "system"
                      ? "后台系统提醒已开启，测试通知已发送"
                      : "网页内提醒已开启，请保持课序页面打开",
                );
              })
            }
            disabled={working || s.saved.mode !== "school"}
            trackColor={{ true: c.accent }}
          />
        </View>
        <Caption>
          {web
            ? reminderMode === "system"
              ? "当前浏览器支持后台系统通知。将按最近一次同步的课表提前 20 分钟发送提醒。"
              : "当前浏览器使用网页内提醒：课序页面保持打开时，会在上课前 20 分钟弹窗并尝试播放提示音和振动。"
            : `提前 ${s.saved.minutes} 分钟，按最新课表安排未来最多50次提醒。调课后重新校正。`}
        </Caption>
        {!web && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {[5, 10, 15, 20, 30, 60].map((n) => (
              <Button
                key={n}
                label={`${n}分`}
                disabled={working || s.saved.mode !== "school"}
                secondary={s.saved.minutes !== n}
                onPress={() =>
                  void action(() => s.setReminder(s.saved.remind, n))
                }
              />
            ))}
          </View>
        )}
        {web && (
          <Caption>
            支持 Web Push
            的浏览器可在网页关闭后提醒；不支持后台推送的安卓自带浏览器和华为浏览器会自动使用网页内提醒。iPhone
            需要先添加到主屏幕并从图标打开才能使用后台通知。
          </Caption>
        )}
        {web && s.saved.remind && (
          <Caption>
            提醒服务器会保存此设备的推送订阅，以及未来最多50次提醒所需的课程名称、时间和地点；关闭提醒或解绑时删除。
          </Caption>
        )}
        {!web && (
          <Caption>
            应用关闭期间无法撤销未获知变更的旧提醒，请在上课前打开 App 核对。
          </Caption>
        )}
      </Card>
      <Section title="自动同步" />
      <Card>
        <Text style={{ color: c.text, fontWeight: "600" }}>
          打开时检查 · 前台每5分钟更新
        </Text>
        <Caption>
          {web
            ? "网页打开时和前台每5分钟检查学校课表；网页关闭后不会持续同步。"
            : "iOS 不保证后台定时运行。全天候服务端监听、APNs 远程推送和小组件尚未实现；不会显示虚假的“实时在线”。"}
        </Caption>
        {s.saved.mode === "school" && (
          <Button
            label={s.busy ? "同步中…" : "立即同步"}
            secondary
            disabled={s.busy}
            onPress={s.sync}
          />
        )}
      </Card>
      <Section title="数据与隐私" />
      <Card>
        <Caption>
          {web
            ? "课表和偏好保存在当前浏览器。学校会话最长保留30天；教务网址、学号和密码会加密保存在仅向本站 /school 接口发送、网页脚本无法读取的 HttpOnly Cookie 中，最长保留180天，用于验证码一键登录。关闭提醒会删除推送订阅；忘记账号只清除登录信息并保留课表，解绑会清理课表、提醒、学校会话和保存的登录信息。"
            : "课表和偏好保存在本机。学校会话由 App 内 WebKit 管理；账号和密码仅在登录时短暂使用，不写入本机缓存，也不读取电脑浏览器凭据或向开发者服务器上传课表。"}
        </Caption>
        <Caption>
          课程减少需在间隔至少30秒的两次一致快照后应用。空表、缺页和不认识的周次不会覆盖缓存。
        </Caption>
        {s.saved.mode !== "empty" && (
          <Button
            label="解绑并清除本机数据"
            secondary
            disabled={working}
            onPress={() => setConfirm("clear")}
          />
        )}
      </Card>
      {confirm === "clear" && (
        <View style={{ marginTop: 14 }}>
          <Card>
            <Text style={{ color: c.text }}>
              确认清除本机课表、变更记录、上课提醒、学校登录状态及已保存账号？
            </Text>
            <Button
              label="确认解绑"
              disabled={working}
              onPress={() => void action(s.clear)}
            />
            <Button
              label="保留数据"
              secondary
              onPress={() => setConfirm(null)}
            />
          </Card>
        </View>
      )}
      {s.saved.mode === "empty" && (
        <View style={{ marginTop: 20 }}>
          <Button label="体验演示课表" secondary onPress={s.demo} />
        </View>
      )}
      <View style={{ marginTop: 24 }}>
        <Caption>
          {web
            ? "当前为独立开发的个人课表工具，并非学校官方客户端。网页端需要本站服务器保持运行；学校接口变化时可能需要更新适配。"
            : "当前为独立开发的个人课表工具，并非学校官方客户端。"}
        </Caption>
      </View>
    </Screen>
  );
}
