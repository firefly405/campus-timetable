import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_THEME_COLOR,
  normalizeThemeColor,
  themePalette,
} from "../src/core/theme.ts";

test("accepts arbitrary hex colors and migrates old preset names", () => {
  assert.equal(normalizeThemeColor("#a1b2c3"), "#A1B2C3");
  assert.equal(normalizeThemeColor("blue"), "#176B87");
  assert.equal(normalizeThemeColor("red"), null);
  assert.equal(normalizeThemeColor("#12345"), null);
});

test("custom color changes the whole palette in light and dark modes", () => {
  const blue = themePalette("#0066FF", false);
  const red = themePalette("#FF2200", false);
  assert.notEqual(blue.bg, red.bg);
  assert.notEqual(blue.card, red.card);
  assert.notEqual(blue.soft, red.soft);
  assert.notEqual(blue.accent, red.accent);
  assert.notEqual(themePalette("#0066FF", true).bg, blue.bg);
  assert.deepEqual(
    themePalette("invalid", false),
    themePalette(DEFAULT_THEME_COLOR, false),
  );
});
