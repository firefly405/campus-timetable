export default function ThemeColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <input
      aria-label="自定义主题颜色"
      type="color"
      value={value}
      onChange={(event) => onChange(event.currentTarget.value.toUpperCase())}
      style={{
        width: 64,
        height: 48,
        padding: 4,
        border: "1px solid currentColor",
        borderRadius: 8,
        background: "transparent",
        cursor: "pointer",
      }}
    />
  );
}
