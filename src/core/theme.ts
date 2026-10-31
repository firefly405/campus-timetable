export const THEMES = [
  { id: "green", label: "青竹绿", swatch: "#18745D" },
  { id: "blue", label: "湖水蓝", swatch: "#176B87" },
  { id: "coral", label: "珊瑚红", swatch: "#A84D45" },
  { id: "gold", label: "暖金色", swatch: "#8A651F" },
] as const;

export const DEFAULT_THEME_COLOR = THEMES[0].swatch;

type RGB = [number, number, number];

export function normalizeThemeColor(value: unknown): string | null {
  const preset = THEMES.find((theme) => theme.id === value);
  if (preset) return preset.swatch;
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toUpperCase()
    : null;
}
function rgb(color: string): RGB {
  return [1, 3, 5].map((offset) =>
    Number.parseInt(color.slice(offset, offset + 2), 16),
  ) as RGB;
}

function hex(value: RGB) {
  return (
    "#" +
    value
      .map((part) => Math.round(part).toString(16).padStart(2, "0"))
      .join("")
  ).toUpperCase();
}

function mix(from: string, to: string, amount: number) {
  const a = rgb(from),
    b = rgb(to);
  return hex(
    a.map((value, index) => value * (1 - amount) + b[index] * amount) as RGB,
  );
}

function luminance(color: string) {
  const channels = rgb(color).map((value) => {
    const channel = value / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(a: string, b: string) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

function readableAccent(color: string, surface: string, dark: boolean) {
  const target = dark ? "#FFFFFF" : "#000000";
  for (let amount = 0; amount <= 1; amount += 0.05) {
    const candidate = mix(color, target, amount);
    if (contrast(candidate, surface) >= 4.5) return candidate;
  }
  return target;
}

export function themePalette(input: string, dark: boolean) {
  const color = normalizeThemeColor(input) ?? DEFAULT_THEME_COLOR;
  if (dark) {
    const bg = mix(color, "#080C0B", 0.78);
    const card = mix(color, "#111716", 0.72);
    return {
      bg,
      card,
      text: "#F3F6F4",
      muted: "#B6C0BC",
      accent: readableAccent(color, card, true),
      soft: mix(color, "#18201E", 0.6),
      line: mix(color, "#77817D", 0.64),
      warm: "#493A20",
      warning: "#F2C46F",
    };
  }
  const bg = mix(color, "#FFFFFF", 0.82);
  const card = mix(color, "#FFFFFF", 0.95);
  return {
    bg,
    card,
    text: "#17211F",
    muted: "#596661",
    accent: readableAccent(color, card, false),
    soft: mix(color, "#FFFFFF", 0.7),
    line: mix(color, "#FFFFFF", 0.55),
    warm: "#F7E4B8",
    warning: "#7A4B12",
  };
}

