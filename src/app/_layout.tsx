import { Tabs, TabList, TabSlot, TabTrigger } from "expo-router/ui";
import { usePathname } from "expo-router";
import Head from "expo-router/head";
import { StatusBar } from "expo-status-bar";
import { Text, View, ActivityIndicator } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Store, useStore } from "../state";
import { ThemeProvider, usePalette } from "../components/ui";
import Portal from "../components/Portal";
import { InstallProvider } from "../components/HomeInstall";
function Shell() {
  const c = usePalette(),
    path = usePathname(),
    store = useStore();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <Head><title>课序</title></Head>
      <StatusBar style="auto" />
      {!store.ready ? (
        <ActivityIndicator style={{ flex: 1 }} color={c.accent} />
      ) : (
        <>
          <Tabs style={{ flex: 1 }}>
            <TabSlot style={{ flex: 1 }} />
            <TabList
              style={{
                flexDirection: "row",
                paddingVertical: 7,
                paddingHorizontal: 12,
                backgroundColor: c.card,
                borderTopWidth: 1,
                borderColor: c.line,
              }}
            >
              {[
                { name: "today", href: "/", label: "今日", icon: "◷" },
                { name: "week", href: "/week", label: "课表", icon: "▦" },
                { name: "changes", href: "/changes", label: "变更", icon: "↻" },
                {
                  name: "settings",
                  href: "/settings",
                  label: "我的",
                  icon: "☷",
                },
              ].map((t) => (
                <TabTrigger
                  key={t.name}
                  name={t.name}
                  href={t.href as "/"}
                  style={{
                    flex: 1,
                    minHeight: 54,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 3,
                    backgroundColor: path === t.href ? c.soft : "transparent",
                    borderRadius: 14,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 23,
                      color: path === t.href ? c.accent : c.muted,
                    }}
                  >
                    {t.icon}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "600",
                      color: path === t.href ? c.accent : c.muted,
                    }}
                  >
                    {t.label}
                    {t.name === "changes" &&
                    store.saved.history.some((x) => !x.read)
                      ? " •"
                      : ""}
                  </Text>
                </TabTrigger>
              ))}
            </TabList>
          </Tabs>
          <Portal key={store.requestId} />
        </>
      )}
    </SafeAreaView>
  );
}
function ThemedShell() {
  const store = useStore();
  return (
    <ThemeProvider color={store.saved.theme}>
      <Shell />
    </ThemeProvider>
  );
}
export default function Layout() {
  return (
    <SafeAreaProvider>
      <InstallProvider>
        <Store>
          <View style={{ flex: 1 }}>
            <ThemedShell />
          </View>
        </Store>
      </InstallProvider>
    </SafeAreaProvider>
  );
}
