export class OutputParser {
  extractJSON<T>(raw: string): T {
    let str = raw.trim();

    // Try to extract from ```json ... ``` code block
    const codeBlock = str.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlock) {
      str = codeBlock[1].trim();
    }

    // Find the first { or [ and its matching closer
    const startObj = str.indexOf('{');
    const startArr = str.indexOf('[');

    let start: number;
    let open: string;
    let close: string;

    if (startObj === -1 && startArr === -1) {
      throw new Error('No JSON object or array found in output');
    } else if (startArr === -1 || (startObj !== -1 && startObj < startArr)) {
      start = startObj;
      open = '{';
      close = '}';
    } else {
      start = startArr;
      open = '[';
      close = ']';
    }

    // Walk forward to find the matching bracket
    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = start; i < str.length; i++) {
      const ch = str[i];

      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\' && inString) {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      if (ch === open) depth++;
      if (ch === close) depth--;

      if (depth === 0) {
        return JSON.parse(str.slice(start, i + 1));
      }
    }

    // Fallback: try parsing from start to end
    return JSON.parse(str.slice(start));
  }

  extractXML(raw: string, tag: string): string | null {
    const re = new RegExp(`<${tag}>[\\s\\S]*?</${tag}>`);
    const match = raw.match(re);
    if (!match) return null;

    // Strip the outer tags
    return match[0]
      .replace(new RegExp(`^<${tag}>`), '')
      .replace(new RegExp(`</${tag}>$`), '')
      .trim();
  }
}
