import { findChildFolder } from "./drive";
import { getCached, setCached } from "./blob-cache";

const FOLDER_CACHE_TTL = 24 * 60 * 60_000; // 24h

export interface BlogFolders {
  rootId: string;
  imagesId: string | null;
}

export async function resolveBlogFolders(): Promise<BlogFolders> {
  const rootId = process.env.GOOGLE_DRIVE_BLOG_FOLDER_ID;
  if (!rootId) throw new Error("GOOGLE_DRIVE_BLOG_FOLDER_ID missing");

  const cacheKey = `meta/folders/${rootId}`;
  const cached = await getCached<BlogFolders>(cacheKey);
  if (cached) return cached;

  const imagesId = await findChildFolder(rootId, "images");
  const result: BlogFolders = { rootId, imagesId };
  await setCached(cacheKey, result, FOLDER_CACHE_TTL);
  return result;
}
