import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { normalizeThemeColor } from "../core/theme";

export default function ThemeColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const valid = normalizeThemeColor(draft);
  return (
    <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
      <TextInput
        accessibilityLabel="自定义主题颜色"
        value={draft}
        onChangeText={setDraft}
        autoCapitalize="characters"
        maxLength={7}
        style={{ borderWidth: 1, borderRadius: 8, padding: 12, minWidth: 110 }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !valid }}
        disabled={!valid}
        onPress={() => valid && onChange(valid)}
        style={{ padding: 14, opacity: valid ? 1 : 0.45 }}
      >
        <Text>应用颜色</Text>
      </Pressable>
    </View>
  );
}
