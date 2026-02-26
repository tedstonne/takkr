/**
 * Shared constants — single source of truth for server + client.
 * Injected into the page as window.__TAKKR__ via Layout.
 */

export const FONTS: Record<string, string> = {
  caveat: "Caveat",
  "indie-flower": "Indie Flower",
  kalam: "Kalam",
  parisienne: "Parisienne",
  cookie: "Cookie",
  handlee: "Handlee",
  sofia: "Sofia",
  "gochi-hand": "Gochi Hand",
  "grand-hotel": "Grand Hotel",
};

export const COLORS = ["yellow", "pink", "green", "blue", "orange"] as const;
export type Color = (typeof COLORS)[number];

export const BACKGROUNDS = [
  "plain",
  "grid",
  "cork",
  "chalkboard",
  "lined",
  "canvas",
  "blueprint",
  "doodle",
] as const;
export type Background = (typeof BACKGROUNDS)[number];

/** Dark backgrounds where text/dots need to be light */
export const DARK_BACKGROUNDS: string[] = ["chalkboard", "blueprint"];

/** Theme presets for landing carousel */
export const THEMES = [
  { bg: "grid",       font: "Caveat",       label: "Classic" },
  { bg: "cork",       font: "Indie Flower",  label: "Cork Board" },
  { bg: "chalkboard", font: "Kalam",         label: "Chalkboard" },
  { bg: "blueprint",  font: "Gochi Hand",    label: "Blueprint" },
  { bg: "lined",      font: "Handlee",       label: "Notebook" },
  { bg: "canvas",     font: "Sofia",         label: "Canvas" },
] as const;

/** JSON blob injected into the page for client-side use */
export const clientConfig = () => JSON.stringify({
  fonts: FONTS,
  colors: COLORS,
  backgrounds: BACKGROUNDS,
  darkBackgrounds: DARK_BACKGROUNDS,
  themes: THEMES,
});
