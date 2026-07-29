export interface TextChunk {
  index: number;
  content: string;
}

export interface ChunkOptions {
  /** Target chunk size in characters. */
  size?: number;
  /** Characters of overlap carried between consecutive chunks. */
  overlap?: number;
}

/**
 * Splits text into overlapping chunks, preferring to break on whitespace/newline
 * boundaries so chunks stay readable. Overlap preserves context that would
 * otherwise be cut across a boundary. Pure + deterministic → unit-tested.
 */
export const chunkText = (text: string, { size = 900, overlap = 150 }: ChunkOptions = {}): TextChunk[] => {
  const clean = text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  if (!clean) return [];
  if (clean.length <= size) return [{ index: 0, content: clean }];

  const chunks: TextChunk[] = [];
  let pos = 0;
  let idx = 0;

  while (pos < clean.length) {
    let end = Math.min(pos + size, clean.length);
    if (end < clean.length) {
      // Back up to the nearest word/line boundary if it isn't too far back.
      const brk = Math.max(clean.lastIndexOf(" ", end), clean.lastIndexOf("\n", end));
      if (brk > pos + size * 0.5) end = brk;
    }
    const content = clean.slice(pos, end).trim();
    if (content) chunks.push({ index: idx++, content });
    if (end >= clean.length) break;
    pos = Math.max(end - overlap, pos + 1);
  }
  return chunks;
};
