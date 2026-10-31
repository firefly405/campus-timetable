import React, { useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import Constants from "expo-constants";
import {
  COURSE_URL,
  COURSE_PATH,
  SCHOOL_ORIGIN,
  allowedSchoolURL,
} from "../core/model";
import { bridgeScript } from "../core/extractor";
import { loginFillScript } from "../core/login";
import { useStore } from "../state";
import { canClearSession } from "../services/device";
import { usePalette } from "./ui";

export default function Portal() {
  const store = useStore(),
    c = usePalette(),
    insets = useSafeAreaInsets();
  const web = useRef<WebView>(null),
    handled = useRef(-1),
    loginPrompted = useRef(-1);
  const [uri, setUri] = useState(store.loginDraft?.loginUrl ?? COURSE_URL);
  function loadCourse() {
    handled.current = -1;
    setUri(COURSE_URL + "?appRefresh=" + Date.now());
  }
  if (
    store.saved.mode !== "school" ||
    !store.saved.httpConsent ||
    !canClearSession() ||
    !Constants.expoConfig?.extra?.allowSchoolHttp
  )
    return null;
  return (
    <View
      pointerEvents={store.portalOpen ? "auto" : "none"}
      accessibilityElementsHidden={!store.portalOpen}
      importantForAccessibility={
        store.portalOpen ? "auto" : "no-hide-descendants"
      }
      style={
        store.portalOpen
          ? {
              position: "absolute",
              inset: 0,
              backgroundColor: c.bg,
              paddingTop: insets.top,
              zIndex: 100,
            }
          : {
              position: "absolute",
              left: -1000,
              top: 0,
              width: 400,
              height: 600,
              opacity: 0,
            }
      }
    >
      <View
        style={{
          padding: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ color: c.text, fontWeight: "700", fontSize: 18 }}>
          学校教务
        </Text>
        <View style={{ flexDirection: "row", gap: 16 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="登录后读取课表"
            onPress={loadCourse}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Text style={{ color: c.accent }}>读取课表</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="关闭学校页面"
            onPress={() => store.setPortalOpen(false)}
            style={{ minWidth: 44, minHeight: 44, justifyContent: "center" }}
          >
            <Text style={{ color: c.accent }}>关闭</Text>
          </Pressable>
        </View>
      </View>
      <Text
        style={{ color: c.muted, paddingHorizontal: 16, paddingBottom: 10 }}
      >
        请在学校页面确认账号和密码，填写验证码并提交。登录后自动读取本学期课表。
      </Text>
      <WebView
        ref={web}
        key={store.requestId}
        source={{ uri: store.loginDraft?.loginUrl ?? uri }}
        style={{ flex: 1 }}
        sharedCookiesEnabled={false}
        thirdPartyCookiesEnabled={false}
        setSupportMultipleWindows={false}
        javaScriptCanOpenWindowsAutomatically={false}
        allowFileAccess={false}
        originWhitelist={["*"]}
        startInLoadingState
        renderLoading={() => <ActivityIndicator color={c.accent} />}
        onShouldStartLoadWithRequest={(r) => allowedSchoolURL(r.url)}
        onNavigationStateChange={(nav) => {
          if (!allowedSchoolURL(nav.url)) return;
          const path = new URL(nav.url).pathname;
          if (path !== "/login" && store.loginDraft) store.clearLoginDraft();
          if (path === "/login" && loginPrompted.current !== store.requestId) {
            loginPrompted.current = store.requestId;
            store.setPortalOpen(true);
            if (!store.loginDraft)
              store.fail("登录已失效，请完成学校登录", store.requestId);
          }
          if (!nav.loading && path === "/") loadCourse();
        }}
        onLoadEnd={(event) => {
          const url = event.nativeEvent.url;
          if (!allowedSchoolURL(url)) return;
          const path = new URL(url).pathname;
          if (path === "/login" && store.loginDraft) {
            web.current?.injectJavaScript(
              loginFillScript(
                store.loginDraft.username,
                store.loginDraft.password,
              ),
            );
          }
          if (path === COURSE_PATH)
            web.current?.injectJavaScript(bridgeScript(store.requestId));
        }}
        onMessage={(event) => {
          const { data, url } = event.nativeEvent;
          if (!allowedSchoolURL(url) || data.length > 2_000_000) return;
          const path = new URL(url).pathname;
          try {
            const message = JSON.parse(data);
            if (path === "/login") {
              if (message.type === "login-form-error")
                store.fail(
                  "学校登录页结构已变化，请在学校页面手动填写",
                  store.requestId,
                );
              return;
            }
            if (path !== COURSE_PATH || handled.current === store.requestId)
              return;
            if (message.requestId !== store.requestId) return;
            handled.current = store.requestId;
            if (message.error)
              store.fail("学校课表未完整加载，请稍后重试", store.requestId);
            else store.accept(message.data, store.requestId);
          } catch {
            store.fail("学校课表返回异常，已保留缓存", store.requestId);
          }
        }}
        onError={() => {
          store.clearLoginDraft();
          store.fail("学校连接失败，显示最近保存的课表", store.requestId);
        }}
        onHttpError={(event) => {
          if (event.nativeEvent.url.startsWith(SCHOOL_ORIGIN))
            store.fail("学校服务暂时异常，稍后自动重试", store.requestId);
        }}
      />
    </View>
  );
}
