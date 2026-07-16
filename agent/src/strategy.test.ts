import { test } from "node:test";
import assert from "node:assert/strict";
import { decideConversion } from "./strategy.ts";

test("holds before the due window opens", () => {
  const d = decideConversion({
    daysToDeadline: 20,
    windowDays: 15,
    currentRate: 33,
    recentMin: 33,
    alreadyConverted: false,
  });
  assert.equal(d.action, "hold");
});

test("holds when already converted", () => {
  const d = decideConversion({
    daysToDeadline: 5,
    windowDays: 15,
    currentRate: 30,
    recentMin: 30,
    alreadyConverted: true,
  });
  assert.equal(d.action, "hold");
});

test("always converts on the due day (deadline guarantee)", () => {
  const d = decideConversion({
    daysToDeadline: 0,
    windowDays: 15,
    currentRate: 40, // even at a bad rate
    recentMin: 32,
    alreadyConverted: false,
  });
  assert.equal(d.action, "convert");
});

test("converts when the window low is caught", () => {
  const d = decideConversion({
    daysToDeadline: 10,
    windowDays: 15,
    currentRate: 32, // equal to recentMin = the dip
    recentMin: 32,
    alreadyConverted: false,
  });
  assert.equal(d.action, "convert");
});

test("holds while above the dip", () => {
  const d = decideConversion({
    daysToDeadline: 10,
    windowDays: 15,
    currentRate: 34, // above the window low
    recentMin: 32,
    alreadyConverted: false,
  });
  assert.equal(d.action, "hold");
});
