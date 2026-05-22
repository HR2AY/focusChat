export function splitIntoChunks(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return [];
  }

  const segments = normalized
    .split(/(?<=[。！？!?；;，,])/u)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return [normalized];
  }

  const chunks: string[] = [];
  let current = '';

  for (const segment of segments) {
    const tentative = current ? `${current}${segment}` : segment;

    if (
      tentative.length <= 14 ||
      current.length < 5
    ) {
      current = tentative;
      continue;
    }

    if (current) {
      chunks.push(current);
    }
    current = segment;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks
    .flatMap((chunk) => {
      if (chunk.length <= 18) {
        return [chunk];
      }

      const parts: string[] = [];
      let buffer = '';
      for (const char of chunk) {
        buffer += char;
        if (buffer.length >= 12) {
          parts.push(buffer);
          buffer = '';
        }
      }
      if (buffer) {
        parts.push(buffer);
      }
      return parts;
    })
    .filter(Boolean);
}
