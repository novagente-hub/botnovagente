import { describe, expect, test } from "bun:test";
import { SETTINGS_SIDEBAR_ITEMS } from "../src/components/settings/settings-sidebar";

describe("settings sidebar", () => {
  test("Browsers links to /settings/browsers, right after Approvals", () => {
    const titles = SETTINGS_SIDEBAR_ITEMS.map((item) => item.title);
    const browsers = SETTINGS_SIDEBAR_ITEMS[titles.indexOf("Navegadores")];

    expect(browsers?.linkOptions).toEqual({ to: "/settings/browsers" });
    expect(titles.indexOf("Navegadores")).toBe(
      titles.indexOf("Aprovações") + 1,
    );
  });

  test("Learning links to /settings/learning, right after Browsers", () => {
    const titles = SETTINGS_SIDEBAR_ITEMS.map((item) => item.title);
    const learning = SETTINGS_SIDEBAR_ITEMS[titles.indexOf("Aprendizado")];

    expect(learning?.linkOptions).toEqual({ to: "/settings/learning" });
    expect(titles.indexOf("Aprendizado")).toBe(
      titles.indexOf("Navegadores") + 1,
    );
  });
});
