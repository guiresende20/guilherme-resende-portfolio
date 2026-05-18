import { connectLambda } from "@netlify/blobs";
import type { HandlerEvent } from "@netlify/functions";

// Lambda-style handlers (HandlerEvent + return) do NOT get NETLIFY_BLOBS_CONTEXT
// auto-injected the way V2 (Request/Response) functions do. Without this call,
// getStore throws MissingBlobsEnvironmentError, which our safeStore helpers
// catch silently — turning every blob write into a no-op.
//
// Call once at the top of every handler that uses @netlify/blobs (directly or
// via blob-cache / vector-store). Idempotent and cheap; safe to call locally
// outside `netlify dev` (caught as no-op).
export function ensureBlobsContext(event: HandlerEvent): void {
  try {
    // HandlerEvent's typing doesn't expose the `blobs` field that Netlify
    // injects, so cast through unknown to satisfy LambdaEvent.
    connectLambda(event as unknown as Parameters<typeof connectLambda>[0]);
  } catch {
    // No blobs context on this event (local invocation without netlify dev,
    // or unit test). Downstream safeStore() helpers degrade to no-op.
  }
}

export interface BlobsContextDiag {
  eventHasBlobs: boolean;
  blobsType: string;
  envHasContext: boolean;
  hasSiteIdHeader: boolean;
  hasDeployIdHeader: boolean;
  connectError: string | null;
}

export function diagnoseBlobsContext(event: HandlerEvent): BlobsContextDiag {
  const e = event as unknown as { blobs?: unknown; headers?: Record<string, string> };
  const diag: BlobsContextDiag = {
    eventHasBlobs: e.blobs !== undefined && e.blobs !== null,
    blobsType: typeof e.blobs,
    envHasContext: Boolean(process.env.NETLIFY_BLOBS_CONTEXT),
    hasSiteIdHeader: Boolean(e.headers?.["x-nf-site-id"]),
    hasDeployIdHeader: Boolean(e.headers?.["x-nf-deploy-id"]),
    connectError: null,
  };
  try {
    connectLambda(event as unknown as Parameters<typeof connectLambda>[0]);
  } catch (err) {
    diag.connectError = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  }
  return diag;
}
