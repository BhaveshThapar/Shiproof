import { test } from "node:test";
import assert from "node:assert/strict";
import { maskComments } from "../checks/source.js";

test("masks an API symbol inside a line comment", () => {
  const masked = maskComments("// uses UserDefaults here\nlet x = 1");
  assert.ok(!/\bUserDefaults\b/.test(masked));
  assert.ok(masked.includes("let x = 1"));
});

test("masks a block comment but keeps surrounding code", () => {
  const masked = maskComments("let a = 1 /* CLLocationManager */ let b = 2");
  assert.ok(!/\bCLLocationManager\b/.test(masked));
  assert.ok(masked.includes("let a = 1"));
  assert.ok(masked.includes("let b = 2"));
});

test("preserves length and line positions so locations stay correct", () => {
  const src = "line one\n// CLLocationManager\nCLLocationManager()";
  const masked = maskComments(src);
  assert.equal(masked.length, src.length);
  // The real usage on line 3 survives; the comment mention on line 2 does not.
  const idx = masked.search(/\bCLLocationManager\b/);
  assert.equal(src.slice(0, idx).split("\n").length, 3);
});

test("does not treat // inside a string literal as a comment", () => {
  const masked = maskComments('let url = "https://example.com/path"');
  assert.ok(masked.includes("https://example.com/path"));
});

test("leaves real code untouched", () => {
  const src = "let store = UserDefaults.standard";
  assert.equal(maskComments(src), src);
});
