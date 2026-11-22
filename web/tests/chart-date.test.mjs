import { test } from "node:test"
import assert from "node:assert/strict"
import { chartDate } from "../src/lib/chart-date.js"

test("log time strings produce valid dates", () => {
  const date = chartDate("18:45:00", 0)
  assert.equal(Number.isNaN(date.getTime()), false)
  assert.equal(date.getUTCHours(), 18)
  assert.equal(date.getUTCMinutes(), 45)
})

test("unknown formats fall back to a monotonic index date", () => {
  const first = chartDate(undefined, 0)
  const second = chartDate("not a time", 1)
  assert.equal(Number.isNaN(first.getTime()), false)
  assert.equal(Number.isNaN(second.getTime()), false)
  assert.ok(second.getTime() > first.getTime())
})
