import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import type { Download } from "playwright";
import { createWorkspace, DEFAULT_WORKSPACE_LIMITS } from "./workspace";
import { workspaceDirectoryFor } from "./workspaces";

/** Only the Playwright operations the delivery process needs. */
type DownloadFile = Pick<Download, "suggestedFilename" | "saveAs">;

export function safeDownloadName(value: string): string {
  const leaf = basename(value.replaceAll("\\", "/"));
  const cleaned = leaf
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._() -]+/gu, "-")
    .replace(/^\.+/, "")
    .replace(/[. ]+$/, "")
    .slice(0, 110);
  return cleaned || "download.bin";
}

/**
 * Chrome's download event is not itself a delivered file: Playwright normally
 * deletes it when the browser context closes. Copy the actual bytes into the
 * Bot's persistent and isolated workspace, then atomically publish the name.
 * Never copy cookies, profiles or any other Bot's files here.
 */
export async function saveBrowserDownload(input: {
  root: string;
  botId: string;
  separateWorkspaces: boolean;
  download: DownloadFile;
  maxBytes?: number;
}): Promise<{ path: string; bytes: number }> {
  const workspace = workspaceDirectoryFor(
    input.root,
    input.botId,
    input.separateWorkspaces,
  );
  await mkdir(workspace, { recursive: true });
  const files = createWorkspace(workspace);
  await mkdir(join(workspace, "entregas"), {
    recursive: true,
    mode: 0o700,
  });
  const key = randomUUID();
  const path = `entregas/${key}-${safeDownloadName(input.download.suggestedFilename())}`;
  const published = await files.resolvePath(path, true);
  const pending = await files.resolvePath(`entregas/.${key}.part`, true);
  try {
    await input.download.saveAs(pending);
    const saved = await stat(pending);
    if (
      !saved.isFile() ||
      saved.size > (input.maxBytes ?? DEFAULT_WORKSPACE_LIMITS.downloadBytes)
    ) {
      throw new Error("Downloaded file exceeds the workspace delivery limit.");
    }
    await rename(pending, published);
    return { path, bytes: saved.size };
  } catch (error) {
    await rm(pending, { force: true }).catch(() => undefined);
    throw error;
  }
}
