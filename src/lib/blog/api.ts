import type { PostMeta } from "./frontmatter";

export interface ListResponse {
  posts: PostMeta[];
  cached: boolean;
}

export async function fetchPostList(): Promise<PostMeta[]> {
  const res = await fetch("/api/blog/list");
  if (!res.ok) throw new Error(`Failed to fetch posts: ${res.status}`);
  const data = (await res.json()) as ListResponse;
  return data.posts;
}

export interface PostResponse {
  meta: PostMeta;
  body: string;
  cached: boolean;
}

export async function fetchPost(slug: string): Promise<PostResponse | null> {
  const res = await fetch(`/api/blog/post/${encodeURIComponent(slug)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch post: ${res.status}`);
  return (await res.json()) as PostResponse;
}
