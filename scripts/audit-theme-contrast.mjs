/** Theme-token contrast diagnostic, not a claim of full page or accessibility conformance. */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const linear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const encoded = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
function color(value) {
  if (/^#[0-9a-f]{6}$/i.test(value))
    return {
      rgb: value
        .slice(1)
        .match(/../g)
        .map((c) => parseInt(c, 16) / 255),
      clipped: false,
    };
  const match = value.match(/^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/);
  if (!match) throw new Error(`Unsupported theme color: ${value}`);
  const [, lightness, chroma, hue] = match.map(Number);
  const a = chroma * Math.cos((hue * Math.PI) / 180),
    b = chroma * Math.sin((hue * Math.PI) / 180);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const channels = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return {
    rgb: channels.map((c) => encoded(Math.max(0, Math.min(1, c)))),
    clipped: channels.some((c) => c < 0 || c > 1),
  };
}
const luminance = (rgb) =>
  rgb.map(linear).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (a, b) =>
  (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
assert.equal(ratio([0, 0, 0], [1, 1, 1]), 21);
assert.equal(ratio([0.5, 0.5, 0.5], [0.5, 0.5, 0.5]), 1);
const css = await readFile("src/app/globals.css", "utf8");
const tokens = (selector) =>
  Object.fromEntries(
    [
      ...css
        .match(new RegExp(`${selector} \\{([\\s\\S]*?)\\n\\}`))[1]
        .matchAll(/--([\w-]+): ([^;]+);/g),
    ].map(([, key, value]) => [key, value])
  );
const light = tokens(":root"),
  dark = { ...light, ...tokens("\\.dark") };
const rows = [];
for (const [theme, values] of Object.entries({ light, dark })) {
  function check(foreground, background, minimum = 4.5, opacity = 1, under = "card") {
    const fg = color(values[foreground]),
      bg = color(values[background]),
      surface = color(values[under]);
    const backgroundRgb = bg.rgb.map(
      (channel, i) => channel * opacity + surface.rgb[i] * (1 - opacity)
    );
    const actual = ratio(fg.rgb, backgroundRgb);
    rows.push({
      theme,
      foreground,
      background,
      opacity,
      under: opacity === 1 ? null : under,
      ratio: Number(actual.toFixed(3)),
      minimum,
      passes: actual >= minimum,
      clippedToSrgb: fg.clipped || bg.clipped || (opacity !== 1 && surface.clipped),
    });
  }
  for (const surface of ["background", "card", "muted", "surface-raised"]) {
    check("foreground", surface);
    check("muted-foreground", surface);
    check("primary", surface);
    check("destructive", surface);
    for (const status of ["on-track", "watch", "attention", "neutral"])
      check(`status-${status}`, surface);
  }
  for (const kind of ["primary", "accent", "destructive"]) {
    check(`${kind}-foreground`, kind);
    check(`${kind}-foreground`, kind, 4.5, 0.9);
  }
  for (const status of ["on-track", "watch", "attention", "neutral"])
    check(`status-${status}`, `status-${status}-bg`);
  check("sidebar-foreground", "sidebar-background");
  check("sidebar-primary-foreground", "sidebar-primary");
  check("sidebar-ring", "sidebar-background", 3);
  check("sidebar-ring", "sidebar-accent", 3);
  for (const surface of ["background", "card"]) {
    check("input", surface, 3);
    check("ring", surface, 3);
  }
}
const report = {
  measuredAt: new Date().toISOString(),
  checks: rows.length,
  failures: rows.filter((row) => !row.passes).length,
  limitation:
    "Token pairs and 90% button hover composition only. Out-of-gamut OKLCH values are flagged; sRGB clipping is not browser gamut mapping. This does not measure every rendered state or establish full WCAG conformance.",
  references: [
    "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html",
    "https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html",
  ],
  rows,
};
const output = process.argv[2];
assert(output, "Report path required");
await writeFile(output, JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify({
    checks: report.checks,
    failures: report.failures,
    failedPairs: rows.filter((row) => !row.passes),
    clippedPairs: rows.filter((row) => row.clippedToSrgb).length,
  })
);
