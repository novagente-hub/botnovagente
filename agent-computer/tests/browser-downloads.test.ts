import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  safeDownloadName,
  saveBrowserDownload,
} from "../src/browser-downloads";
import { createWorkspace } from "../src/workspace";
import { workspaceDirectoryFor } from "../src/workspaces";

let root = "";

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "novabot-browser-delivery-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const fake = (name: string, contents: string) => ({
  suggestedFilename: () => name,
  saveAs: async (target: string) => {
    await writeFile(target, contents);
  },
});

describe("browser download delivery", () => {
  test("sanitizes hostile and path-like site filenames", () => {
    expect(safeDownloadName("../../a/b/contrato.pdf")).toBe("contrato.pdf");
    expect(safeDownloadName("..\\..\\dados.csv")).toBe("dados.csv");
    expect(safeDownloadName("...")).toBe("download.bin");
    expect(safeDownloadName("a<>b.pdf")).toBe("a-b.pdf");
  });

  test("saves the actual downloaded bytes and lists them in the Bot workspace", async () => {
    const saved = await saveBrowserDownload({
      root,
      botId: "bot_a",
      separateWorkspaces: true,
      download: fake("report.pdf", "%PDF-fake-test"),
    });
    expect(saved.path).toMatch(/^entregas\/[0-9a-f-]+-report\.pdf$/);
    const workspace = workspaceDirectoryFor(root, "bot_a", true);
    const files = createWorkspace(workspace);
    const listed = await files.list("entregas");
    expect(listed.entries.map((entry) => entry.path)).toContain(saved.path);
    expect((await readFile(join(workspace, saved.path))).toString()).toBe(
      "%PDF-fake-test",
    );
    expect(saved.bytes).toBe(Buffer.byteLength("%PDF-fake-test"));
  });

  test("keeps other agents from listing each other's files", async () => {
    const saved = await saveBrowserDownload({
      root,
      botId: "bot_a",
      separateWorkspaces: true,
      download: fake("data.csv", "123"),
    });
    const other = workspaceDirectoryFor(root, "bot_b", true);
    await expect(createWorkspace(other).read(saved.path)).rejects.toThrow();
    const own = await createWorkspace(
      workspaceDirectoryFor(root, "bot_a", true),
    ).read(saved.path);
    expect(own.bytes).toBe(3);
  });

  test("rejects overlarge downloads without publishing a partial file", async () => {
    await expect(
      saveBrowserDownload({
        root,
        botId: "bot_a",
        separateWorkspaces: true,
        download: fake("big.bin", "1234567890"),
        maxBytes: 5,
      }),
    ).rejects.toThrow(/exceeds/);
    const dir = join(workspaceDirectoryFor(root, "bot_a", true), "entregas");
    expect(await readdir(dir)).toEqual([]);
  });

  test("does not leave partial files when the site download fails", async () => {
    await expect(
      saveBrowserDownload({
        root,
        botId: "bot_a",
        separateWorkspaces: true,
        download: {
          suggestedFilename: () => "bad.pdf",
          saveAs: async (path: string) => {
            await writeFile(path, "unfinished");
            throw new Error("download canceled");
          },
        },
      }),
    ).rejects.toThrow("download canceled");
    const dir = join(workspaceDirectoryFor(root, "bot_a", true), "entregas");
    expect(await readdir(dir)).toEqual([]);
  });

  test("generates a distinct filename for repeated downloads", async () => {
    const values = [];
    for (let i = 0; i < 2; i++) {
      values.push(
        await saveBrowserDownload({
          root,
          botId: "bot_a",
          separateWorkspaces: true,
          download: fake("report.pdf", String(i)),
        }),
      );
    }
    expect(values[0]?.path).not.toBe(values[1]?.path);
    expect(values[0]?.bytes).toBe(1);
  });
});
