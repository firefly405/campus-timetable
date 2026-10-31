import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { PropsWithChildren } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { installBrowser } from "../core/install";
import { Button, Caption, Card, Heading, Screen, usePalette } from "./ui";

type InstallEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
const InstallContext = createContext({
  event: null as InstallEvent | null,
  installed: false,
  clear: () => {},
});

// Listen at the root so opening another route first does not lose the browser's one-shot event.
export function InstallProvider({ children }: PropsWithChildren) {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => {});
    const media = window.matchMedia("(display-mode: standalone)");
    const update = () =>
      setInstalled(
        media.matches ||
          (navigator as Navigator & { standalone?: boolean }).standalone ===
            true,
      );
    const before = (e: Event) => {
      if (typeof (e as InstallEvent).prompt !== "function") return;
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    const complete = () => {
      setEvent(null);
      setInstalled(true);
    };
    update();
    media.addEventListener("change", update);
    window.addEventListener("beforeinstallprompt", before);
    window.addEventListener("appinstalled", complete);
    return () => {
      media.removeEventListener("change", update);
      window.removeEventListener("beforeinstallprompt", before);
      window.removeEventListener("appinstalled", complete);
    };
  }, []);
  return (
    <InstallContext.Provider
      value={{ event, installed, clear: () => setEvent(null) }}
    >
      {children}
    </InstallContext.Provider>
  );
}

const instructions = {
  ios: [
    "在 iPhone 或 iPad 的 Safari 浏览器中打开课序。",
    "点击浏览器的“分享”按钮（方框向上箭头）；部分版本需先打开“更多”菜单。",
    "在分享菜单中找到“添加到主屏幕”。没有看到时，可向下滚动菜单。",
    "名称保留“课序”，如有“作为网页 App 打开”选项请开启，再点“添加”。",
  ],
  android: [
    "在 Chrome、Edge、三星浏览器或手机自带浏览器中打开课序。",
    "打开浏览器菜单（通常是右上角 ⋮ 或底部 ☰）。",
    "选择“安装应用”或“添加到主屏幕”，按提示确认添加。",
    "若没有这个选项，可换用最新版 Chrome；部分浏览器添加的是网页快捷方式。",
  ],
  harmony: [
    "在华为浏览器中打开课序。",
    "打开浏览器菜单（通常位于底部工具栏或“更多”中）。",
    "选择“添加至桌面”或“添加到桌面”，并允许创建桌面快捷方式。",
    "名称保留“课序”并确认添加，以后可从桌面图标直接打开。",
  ],
};

export default function HomeInstall() {
  const c = usePalette(),
    install = useContext(InstallContext);
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "harmony">(
    "ios",
  );
  const [embedded, setEmbedded] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [address, setAddress] = useState("");
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const prompting = useRef(false);
  function openGuide() {
    const browser = installBrowser(
      navigator.userAgent,
      navigator.maxTouchPoints,
    );
    setPlatform(browser.platform === "desktop" ? "ios" : browser.platform);
    setEmbedded(browser.embedded);
    setDesktop(browser.platform === "desktop");
    setAddress(window.location.origin + "/");
    setMessage("");
    setCopied(false);
    setOpen(true);
  }
  async function requestInstall() {
    const event = install.event;
    if (!event || prompting.current) return;
    prompting.current = true;
    setBusy(true);
    install.clear();
    try {
      await event.prompt();
      const choice = await event.userChoice;
      setMessage(
        choice.outcome === "accepted"
          ? "已提交安装，请查看设备上的课序图标。"
          : "已取消安装。你仍可以按下面的步骤添加。",
      );
    } catch {
      setMessage("浏览器未能打开安装窗口，请按下面的步骤添加。");
    } finally {
      prompting.current = false;
      setBusy(false);
    }
  }
  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
    } catch {
      setMessage("复制未完成，请长按下方网址复制，再用手机浏览器打开。");
    }
  }
  if (install.installed) return null;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="添加到主屏幕"
        onPress={openGuide}
        style={({ pressed }) => ({
          marginBottom: 20,
          opacity: pressed ? 0.75 : 1,
        })}
      >
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <Text
              style={{ color: c.accent, fontSize: 30 }}
              accessibilityElementsHidden
            >
              ＋
            </Text>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: c.text, fontWeight: "700", fontSize: 16 }}>
                添加到主屏幕
              </Text>
              <Caption>苹果 / 安卓 / 鸿蒙 · 点图标，直接看课表</Caption>
            </View>
            <Text style={{ color: c.muted, fontSize: 24 }}>›</Text>
          </View>
        </Card>
      </Pressable>
      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
          <Screen>
            <Button
              label="关闭添加指引"
              secondary
              onPress={() => setOpen(false)}
            />
            <View style={{ height: 24 }} />
            <Heading
              eyebrow="随手打开课序"
              title="把课表放到主屏幕"
              subtitle="添加一次，以后点课序图标就能打开。"
            />
            {(embedded || desktop) && (
              <View style={{ marginBottom: 16 }}>
                <Card>
                  <Caption>
                    {embedded
                      ? "你可能正在微信、QQ 等应用内查看。请从应用菜单选择“在浏览器打开”，或复制网址到 Safari、Chrome 或华为浏览器。"
                      : "在手机浏览器中打开下方网址，再按对应步骤添加。"}
                  </Caption>
                </Card>
              </View>
            )}
            {(install.event || busy) && (
              <View style={{ marginBottom: 16 }}>
                <Button
                  label={busy ? "等待浏览器确认…" : "立即安装课序"}
                  disabled={busy}
                  onPress={requestInstall}
                />
              </View>
            )}
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <View style={{ flexGrow: 1, flexBasis: 100 }}>
                <Button
                  label="苹果设备"
                  secondary={platform !== "ios"}
                  onPress={() => setPlatform("ios")}
                />
              </View>
              <View style={{ flexGrow: 1, flexBasis: 100 }}>
                <Button
                  label="安卓手机"
                  secondary={platform !== "android"}
                  onPress={() => setPlatform("android")}
                />
              </View>
              <View style={{ flexGrow: 1, flexBasis: 100 }}>
                <Button
                  label="鸿蒙手机"
                  secondary={platform !== "harmony"}
                  onPress={() => setPlatform("harmony")}
                />
              </View>
            </View>
            <Card>
              {instructions[platform].map((step, index) => (
                <View key={step} style={{ flexDirection: "row", gap: 12 }}>
                  <Text
                    style={{
                      color: c.accent,
                      fontWeight: "700",
                      lineHeight: 25,
                    }}
                  >
                    {index + 1}
                  </Text>
                  <Text
                    style={{
                      flex: 1,
                      color: c.text,
                      fontSize: 15,
                      lineHeight: 25,
                    }}
                  >
                    {step}
                  </Text>
                </View>
              ))}
            </Card>
            <View style={{ marginTop: 16, gap: 12 }}>
              <Caption>
                如遇 ngrok 访问提示，先点 Visit Site
                进入课序。添加后如提示未绑定，请在主屏幕入口中重新绑定一次。
              </Caption>
              <Text
                selectable
                style={{ color: c.accent, fontSize: 13, lineHeight: 21 }}
              >
                {address}
              </Text>
              <Button
                label={copied ? "网址已复制" : "复制课序网址"}
                secondary
                onPress={copyAddress}
              />
              {message ? (
                <Text
                  accessibilityLiveRegion="polite"
                  style={{ color: c.text, lineHeight: 22 }}
                >
                  {message}
                </Text>
              ) : null}
              <Caption>添加后仍需联网同步课表；关闭网页不会持续同步。</Caption>
            </View>
          </Screen>
        </SafeAreaView>
      </Modal>
    </>
  );
}
