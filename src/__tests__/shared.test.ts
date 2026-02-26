import { describe, expect, test } from "bun:test";
import { FONTS, COLORS, BACKGROUNDS, DARK_BACKGROUNDS, THEMES, clientConfig } from "@/shared";
import * as Note from "@/note";
import * as Board from "@/board";
import * as User from "@/user";

describe("shared config", () => {
  test("FONTS has 9 entries", () => {
    expect(Object.keys(FONTS).length).toBe(9);
    expect(FONTS.caveat).toBe("Caveat");
    expect(FONTS["gochi-hand"]).toBe("Gochi Hand");
  });

  test("COLORS has 5 entries", () => {
    expect(COLORS.length).toBe(5);
    expect(COLORS).toContain("yellow");
    expect(COLORS).toContain("orange");
  });

  test("BACKGROUNDS has 8 entries", () => {
    expect(BACKGROUNDS.length).toBe(8);
    expect(BACKGROUNDS).toContain("grid");
    expect(BACKGROUNDS).toContain("blueprint");
  });

  test("DARK_BACKGROUNDS are subset of BACKGROUNDS", () => {
    for (const bg of DARK_BACKGROUNDS) {
      expect(BACKGROUNDS).toContain(bg);
    }
  });

  test("THEMES reference valid backgrounds and fonts", () => {
    for (const theme of THEMES) {
      expect(BACKGROUNDS).toContain(theme.bg);
      expect(Object.values(FONTS)).toContain(theme.font);
    }
  });

  test("Note.COLORS matches shared COLORS", () => {
    expect(Note.COLORS).toEqual([...COLORS]);
  });

  test("User.COLORS matches shared COLORS", () => {
    expect([...User.COLORS]).toEqual([...COLORS]);
  });

  test("Board.BACKGROUNDS matches shared BACKGROUNDS", () => {
    expect([...Board.BACKGROUNDS]).toEqual([...BACKGROUNDS]);
  });

  test("User.FONTS matches shared FONTS", () => {
    expect(User.FONTS).toEqual(FONTS);
  });

  test("clientConfig returns valid JSON with all keys", () => {
    const config = JSON.parse(clientConfig());
    expect(config.fonts).toEqual(FONTS);
    expect(config.colors).toEqual([...COLORS]);
    expect(config.backgrounds).toEqual([...BACKGROUNDS]);
    expect(config.darkBackgrounds).toEqual(DARK_BACKGROUNDS);
    expect(config.themes).toEqual(THEMES.map(t => ({ ...t })));
  });
});
