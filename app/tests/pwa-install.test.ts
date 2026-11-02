import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isStandalonePwa, mobileInstallInstructions } from "../src/lib/pwa";

const publicDir = join(import.meta.dir, "../public");

describe("NovaBot PWA instalável", () => {
	test("o manifesto contém ícones válidos e abre como aplicativo", () => {
		const manifest = JSON.parse(
			readFileSync(join(publicDir, "manifest.webmanifest"), "utf8"),
		);
		expect(manifest.name).toContain("NOVAGENTE");
		expect(manifest.display).toBe("standalone");
		expect(manifest.scope).toBe("/");
		expect(manifest.start_url).toBe("/");
		expect(manifest.icons).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ sizes: "192x192", purpose: "any" }),
				expect.objectContaining({ sizes: "512x512", purpose: "any" }),
				expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
			]),
		);
		for (const icon of manifest.icons) {
			const content = readFileSync(join(publicDir, icon.src.slice(1)));
			expect(content.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
			expect(
				String(content.readUInt32BE(16)) +
					"x" +
					String(content.readUInt32BE(20)),
			).toBe(icon.sizes);
		}
	});

	test("explica instalação em iPhone e Android", () => {
		expect(
			mobileInstallInstructions("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)"),
		).toContain("Compartilhar");
		expect(
			mobileInstallInstructions("Mozilla/5.0 (Linux; Android 15)"),
		).toContain("Chrome");
	});

	test("oculta instalação ao executar como aplicativo", () => {
		expect(isStandalonePwa(() => ({ matches: true }))).toBe(true);
		expect(isStandalonePwa(() => ({ matches: false }), true)).toBe(true);
		expect(isStandalonePwa(() => ({ matches: false }))).toBe(false);
	});

	test("service worker não coloca conversas nem API em cache", () => {
		const sw = readFileSync(join(publicDir, "sw.js"), "utf8");
		expect(sw).toContain('const OFFLINE_URL = "/offline.html"');
		expect(sw).toContain('event.request.mode !== "navigate"');
		expect(sw).toContain('url.pathname.startsWith("/api/")');
		expect(sw).not.toContain("cache.put(event.request");
	});
});
