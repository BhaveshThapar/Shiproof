/**
 * Source-text helpers shared by the checks that pattern-match raw code
 * (required-reason APIs, purpose strings).
 *
 * API symbols are routinely named in code comments (e.g. a line comment saying an
 * app no longer uses UserDefaults). Matching those is a false positive, and false
 * positives are the wedge's enemy. `maskComments` neutralizes comment regions
 * before matching.
 */

/**
 * Replace the contents of line comments and block comments with spaces, leaving
 * everything else — including string literals — byte-for-byte in place. Length
 * and newline positions are preserved, so a match index into the masked string
 * still maps to the right line in the original.
 */
export function maskComments(content: string): string {
  const out: string[] = [];
  let state: "code" | "line" | "block" | "string" | "char" = "code";

  for (let i = 0; i < content.length; i++) {
    const c = content[i] ?? "";
    const next = content[i + 1] ?? "";

    switch (state) {
      case "code":
        if (c === "/" && next === "/") {
          state = "line";
          out.push(" ", " ");
          i++;
        } else if (c === "/" && next === "*") {
          state = "block";
          out.push(" ", " ");
          i++;
        } else {
          if (c === '"') state = "string";
          else if (c === "'") state = "char";
          out.push(c);
        }
        break;

      case "line":
        if (c === "\n") {
          state = "code";
          out.push("\n");
        } else {
          out.push(" ");
        }
        break;

      case "block":
        if (c === "*" && next === "/") {
          state = "code";
          out.push(" ", " ");
          i++;
        } else {
          out.push(c === "\n" ? "\n" : " ");
        }
        break;

      case "string":
        out.push(c);
        if (c === "\\") {
          out.push(next);
          i++;
        } else if (c === '"') {
          state = "code";
        }
        break;

      case "char":
        out.push(c);
        if (c === "\\") {
          out.push(next);
          i++;
        } else if (c === "'") {
          state = "code";
        }
        break;
    }
  }

  return out.join("");
}
