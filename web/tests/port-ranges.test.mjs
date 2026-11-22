import { test } from "node:test"
import assert from "node:assert/strict"
import { portRange, portRangeCounts } from "../src/lib/port-ranges.js"

test("port boundaries map to the right range", () => {
  assert.equal(portRange(0), "well-known")
  assert.equal(portRange(1023), "well-known")
  assert.equal(portRange(1024), "registered")
  assert.equal(portRange(49151), "registered")
  assert.equal(portRange(49152), "ephemeral")
  assert.equal(portRange(65535), "ephemeral")
  assert.equal(portRange("8008"), "registered")
  assert.equal(portRange(70000), null)
  assert.equal(portRange("nope"), null)
})

test("range counts aggregate a long tail without an Other bucket", () => {
  const result = portRangeCounts({ 22: 4, 443: 6, 8008: 10, 52323: 30, 55409: 50 })
  assert.deepEqual(result.map((item) => item.key), ["well-known", "registered", "ephemeral"])
  assert.equal(result[0].count, 10)
  assert.equal(result[1].count, 10)
  assert.equal(result[2].count, 80)
  assert.equal(result.reduce((sum, item) => sum + item.percent, 0), 100)
})

test("empty input returns no slices", () => {
  assert.deepEqual(portRangeCounts({}), [])
})
