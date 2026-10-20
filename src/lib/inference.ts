const INFERENCE = /^\s*(\*\*)?Inference:(\*\*)?\s*/i;

export interface Part {
  inference: boolean;
  text: string;
}

/** Split model output into Markdown parts and standalone "Inference:" lines, so the latter can be shown apart from cited claims. */
export function splitInference(content: string): Part[] {
  const parts: Part[] = [];
  let buf: string[] = [];
  const flush = () => {
    if (buf.length) parts.push({ inference: false, text: buf.join('\n') });
    buf = [];
  };
  for (const line of content.split('\n')) {
    if (INFERENCE.test(line)) {
      flush();
      parts.push({ inference: true, text: line.replace(INFERENCE, '') });
    } else buf.push(line);
  }
  flush();
  return parts;
}
