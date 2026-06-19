/**
 * Lightweight GitHub Actions Marketplace metadata check for `action.yml`. The
 * Marketplace rejects a listing whose `branding.color` is not one of its eight
 * allowed colours, or that is missing `name` / `description` / `branding.icon` /
 * `runs`. That rejection happens at publish time, in the browser — so this turns
 * it into a `npm test` gate (ROADMAP §A: "validate action.yml vs the Marketplace
 * schema"). It is intentionally a metadata lint, not a full YAML schema parser.
 */

/** The exact set GitHub accepts for `branding.color`. */
export const MARKETPLACE_BRANDING_COLORS = [
  "white",
  "yellow",
  "blue",
  "green",
  "orange",
  "red",
  "purple",
  "gray-dark",
] as const;

/** Reads a top-level `key:` value (column 0). Returns undefined if absent/empty. */
function topLevelValue(yaml: string, key: string): string | undefined {
  const match = yaml.match(new RegExp(`^${key}:[ \\t]*(.*)$`, "m"));
  if (!match) return undefined;
  const value = (match[1] ?? "").trim().replace(/^["']|["']$/g, "");
  return value.length > 0 ? value : undefined;
}

/** Reads a `key:` nested under the `branding:` block (one level of indentation). */
function brandingValue(yaml: string, key: string): string | undefined {
  const block = yaml.match(/^branding:[ \t]*\n((?:[ \t]+.*\n?)*)/m);
  if (!block) return undefined;
  const match = block[1]?.match(new RegExp(`^[ \\t]+${key}:[ \\t]*(.*)$`, "m"));
  if (!match) return undefined;
  const value = (match[1] ?? "").trim().replace(/^["']|["']$/g, "");
  return value.length > 0 ? value : undefined;
}

/**
 * Returns a list of Marketplace problems with the action metadata. Empty ⇒ the
 * listing fields GitHub validates at publish time are present and well-formed.
 */
export function validateActionYml(yaml: string): string[] {
  const problems: string[] = [];

  if (!topLevelValue(yaml, "name")) problems.push("missing required top-level `name`");
  if (!topLevelValue(yaml, "description")) {
    problems.push("missing required top-level `description`");
  }
  if (!/^runs:/m.test(yaml)) problems.push("missing required `runs` section");

  const icon = brandingValue(yaml, "icon");
  if (!icon) {
    problems.push("missing `branding.icon` (required for a Marketplace listing)");
  } else if (!/^[a-z0-9-]+$/.test(icon)) {
    problems.push(`branding.icon "${icon}" must be a lowercase Feather icon name`);
  }

  const color = brandingValue(yaml, "color");
  if (!color) {
    problems.push("missing `branding.color` (required for a Marketplace listing)");
  } else if (
    !MARKETPLACE_BRANDING_COLORS.includes(color as (typeof MARKETPLACE_BRANDING_COLORS)[number])
  ) {
    problems.push(
      `branding.color "${color}" is not allowed — use one of: ${MARKETPLACE_BRANDING_COLORS.join(", ")}`,
    );
  }

  return problems;
}
