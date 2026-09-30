# Local image quality policy

User decision, 2026-09-29: storage savings must not remove image detail.

- Imported originals remain byte-for-byte copies in app-owned storage.
- No automatic downsampling, JPEG quality reduction, colour conversion,
  metadata stripping, or replacement of the original with a thumbnail.
- Existing bounded thumbnails are disposable browsing previews. Full-screen
  viewing and export must continue to use the original, never a thumbnail.
- Folder moves change membership only; they must not duplicate or re-encode
  media files. This is the safest storage improvement in the folder plan.
- A future lossless encoder is acceptable only if it preserves dimensions,
  orientation, alpha, colour interpretation and all decoded pixels, produces
  a smaller file, and passes the same streamed/journaled integrity rules as
  import. Do not add an unbounded full-resolution decode to import for it.
- Compressed JPEG/HEIC images may offer no safe material reduction. Keep
  them unchanged rather than promise a quality-preserving saving.

No network service, cloud optimiser, account or sync is involved. No image
compression dependency or media/archive format migration is introduced by
the current brand and alarm fixes.
