/**
 * Minimal XML property-list parser — just enough to read Info.plist and
 * PrivacyInfo.xcprivacy. Xcode writes these as XML plists by default.
 *
 * Scope: handles dict, array, string, integer, real, true, false, data, date.
 * Binary plists (bplist) are out of scope; the CLI detects and skips those.
 */

export type PlistValue = string | number | boolean | PlistValue[] | { [key: string]: PlistValue };

type Token =
  | { type: "open"; name: string }
  | { type: "close"; name: string }
  | { type: "self"; name: string }
  | { type: "text"; value: string };

const TAG_RE =
  /<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!DOCTYPE[^>]*>|<(\/?)([A-Za-z0-9]+)[^>]*?(\/?)>|([^<]+)/g;

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, "&");
}

function tokenize(xml: string): Token[] {
  const tokens: Token[] = [];
  for (const match of xml.matchAll(TAG_RE)) {
    const [, closing, name, selfClose, text] = match;
    if (name) {
      if (closing === "/") tokens.push({ type: "close", name });
      else if (selfClose === "/") tokens.push({ type: "self", name });
      else tokens.push({ type: "open", name });
    } else if (text !== undefined) {
      tokens.push({ type: "text", value: text });
    }
    // Processing instructions / comments / doctype match with no captures: skip.
  }
  return tokens;
}

class PlistParseError extends Error {}

type Cursor = { tokens: Token[]; pos: number };

function peek(cursor: Cursor): Token | undefined {
  return cursor.tokens[cursor.pos];
}

/** Skip whitespace-only text tokens; used wherever structure is expected. */
function skipWhitespace(cursor: Cursor): void {
  while (true) {
    const token = peek(cursor);
    if (token && token.type === "text" && token.value.trim() === "") cursor.pos++;
    else break;
  }
}

function readText(cursor: Cursor): string {
  let out = "";
  while (true) {
    const token = peek(cursor);
    if (token && token.type === "text") {
      out += token.value;
      cursor.pos++;
    } else break;
  }
  return decodeEntities(out);
}

function expectClose(cursor: Cursor, name: string): void {
  skipWhitespace(cursor);
  const token = peek(cursor);
  if (!token || token.type !== "close" || token.name !== name) {
    throw new PlistParseError(`Expected </${name}>`);
  }
  cursor.pos++;
}

function parseValue(cursor: Cursor): PlistValue {
  skipWhitespace(cursor);
  const token = peek(cursor);
  if (!token) throw new PlistParseError("Unexpected end of plist");

  if (token.type === "self") {
    cursor.pos++;
    if (token.name === "true") return true;
    if (token.name === "false") return false;
    if (token.name === "string") return "";
    if (token.name === "array") return [];
    if (token.name === "dict") return {};
    throw new PlistParseError(`Unexpected self-closing <${token.name}/>`);
  }

  if (token.type !== "open") {
    throw new PlistParseError(`Expected a value, got ${token.type}`);
  }

  cursor.pos++;
  const name = token.name;
  switch (name) {
    case "true":
      expectClose(cursor, "true");
      return true;
    case "false":
      expectClose(cursor, "false");
      return false;
    case "string":
    case "date":
    case "data": {
      const value = readText(cursor);
      expectClose(cursor, name);
      return value;
    }
    case "integer":
    case "real": {
      const raw = readText(cursor).trim();
      expectClose(cursor, name);
      return Number(raw);
    }
    case "array": {
      const items: PlistValue[] = [];
      while (true) {
        skipWhitespace(cursor);
        const next = peek(cursor);
        if (next && next.type === "close" && next.name === "array") {
          cursor.pos++;
          break;
        }
        if (!next) throw new PlistParseError("Unterminated <array>");
        items.push(parseValue(cursor));
      }
      return items;
    }
    case "dict": {
      const obj: { [key: string]: PlistValue } = {};
      while (true) {
        skipWhitespace(cursor);
        const next = peek(cursor);
        if (next && next.type === "close" && next.name === "dict") {
          cursor.pos++;
          break;
        }
        if (!next || next.type !== "open" || next.name !== "key") {
          throw new PlistParseError("Expected <key> in <dict>");
        }
        cursor.pos++;
        const key = readText(cursor);
        expectClose(cursor, "key");
        obj[key] = parseValue(cursor);
      }
      return obj;
    }
    default:
      throw new PlistParseError(`Unsupported plist element <${name}>`);
  }
}

/** Parse an XML plist string into a JS value. Throws on malformed input. */
export function parsePlist(xml: string): PlistValue {
  if (xml.startsWith("bplist")) {
    throw new PlistParseError("Binary plist is not supported; export as XML.");
  }
  const cursor: Cursor = { tokens: tokenize(xml), pos: 0 };
  skipWhitespace(cursor);
  const root = peek(cursor);
  if (root && root.type === "open" && root.name === "plist") {
    cursor.pos++;
    const value = parseValue(cursor);
    expectClose(cursor, "plist");
    return value;
  }
  // Some files omit the <plist> wrapper; parse the first value directly.
  return parseValue(cursor);
}

export function isPlistDict(value: PlistValue | undefined): value is { [key: string]: PlistValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
