import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const appDir = join(import.meta.dir, "..");

describe("NovaBot standalone mobile keyboard layout", () => {
  test("requests layout viewport resizing when Android opens the keyboard", () => {
    const html = readFileSync(join(appDir, "index.html"), "utf8");
    expect(html).toContain("interactive-widget=resizes-content");
  });
  test("uses dynamic viewport height instead of stable viewport height", () => {
    const route = readFileSync(join(appDir, "src/routes/_authed/_app.tsx"), "utf8");
    expect(route).toContain("novagente-chat-shell dark h-dvh");
    expect(route).toContain("viewport.addEventListener");
  });
  test("keeps the editor fixed above the keyboard in mobile standalone", () => {
    const css = readFileSync(join(appDir, "src/novagente-chat.css"), "utf8");
    expect(css).toContain("position: fixed;");
    expect(css).toContain("var(--novabot-keyboard-inset, 0px)");
    expect(css).toContain("overflow-y: auto");
    expect(css).toContain("env(safe-area-inset-bottom)");
  });
});
