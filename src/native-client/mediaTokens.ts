/**
 * MR-08: `thumbnailToken`/`sourceToken` are "opaque app-local token[s]
 * consumed by an image provider... not an absolute path" — the branded types
 * (`ThumbnailToken`/`MediaSourceToken` in `types.ts`) make that unenforceable-
 * at-runtime rule enforceable at compile time: nothing else in the codebase
 * can pass one where a plain `string`/URL is expected without going through
 * one of the two functions below.
 *
 * Their concrete runtime value is a `file://` URI into this app's own
 * private storage (native side: `MediaDtoWriter.kt`) — safe to hand directly
 * to `Image`/`Video` `source` props since Android resolves `file://` without
 * any content-provider indirection, and the value never leaves this process.
 * This module is the single "image provider" the spec describes: everywhere
 * else, a token stays opaque.
 */
import type {MediaSourceToken, ThumbnailToken} from './types';

export function thumbnailImageSource(token: ThumbnailToken | undefined): {uri: string} | undefined {
  if (token === undefined) {
    return undefined;
  }
  return {uri: token as unknown as string};
}

export function mediaPlaybackSource(token: MediaSourceToken): {uri: string} {
  return {uri: token as unknown as string};
}
