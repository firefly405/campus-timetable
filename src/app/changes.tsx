import { Text, View } from "react-native";
import { useStore } from "../state";
import {
  Button,
  Caption,
  Card,
  Heading,
  Screen,
  usePalette,
} from "../components/ui";
export default function Changes() {
  const s = useStore(),
    c = usePalette();
  return (
    <Screen>
      <Heading
        eyebrow="CHANGE LOG"
        title="每一次变更，都清楚"
        subtitle="首次同步建立基准，后续变化会保留前后对照。"
      />
      <View style={{ gap: 10, marginBottom: 20 }}>
        {s.saved.mode === "demo" && (
          <Button label="演示一次教室变更" onPress={s.demoChange} />
        )}
        {!!s.saved.history.length && (
          <Button label="全部标为已读" secondary onPress={s.markRead} />
        )}
      </View>
      {!s.saved.history.length ? (
        <Card>
          <Text style={{ color: c.text, fontSize: 20, fontWeight: "600" }}>
            还没有课程变更
          </Text>
          <Caption>
            {s.saved.mode === "demo"
              ? "点击上方按钮，体验自动更新与前后对照。"
              : "学校发布的课程变化在成功同步后会出现在这里。"}
          </Caption>
        </Card>
      ) : (
        s.saved.history.map((change) => (
          <View key={change.id} style={{ marginBottom: 14 }}>
            <Card>
              <View
                style={{
                  flexDirection: "row",
                  gap: 10,
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ color: c.accent, fontWeight: "600" }}>
                  {change.type === "added"
                    ? "新增课程"
                    : change.type === "removed"
                      ? "课程移除"
                      : "课程调整"}
                  {!change.read ? " · 未读" : ""}
                </Text>
                <Caption>
                  {s.saved.mode === "demo"
                    ? "演示"
                    : new Date(change.at).toLocaleDateString("zh-CN")}
                </Caption>
              </View>
              <Text style={{ fontSize: 20, fontWeight: "700", color: c.text }}>
                {change.title}
              </Text>
              <Caption>调整前</Caption>
              <Text style={{ color: c.muted, lineHeight: 23 }}>
                {change.before}
              </Text>
              <Caption>调整后</Caption>
              <Text style={{ color: c.text, lineHeight: 23 }}>
                {change.after}
              </Text>
            </Card>
          </View>
        ))
      )}
    </Screen>
  );
}
