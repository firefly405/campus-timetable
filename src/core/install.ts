export function installBrowser(userAgent: string, maxTouchPoints = 0) {
  const platform =
    /iPhone|iPad|iPod/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)
      ? "ios"
      : /HarmonyOS|OpenHarmony|ArkWeb|HuaweiBrowser/i.test(userAgent)
        ? "harmony"
        : /Android/i.test(userAgent)
          ? "android"
          : "desktop";
  return {
    platform,
    embedded: /MicroMessenger|\bQQ\/|Weibo|DingTalk|AlipayClient/i.test(
      userAgent,
    ),
  } as const;
}
