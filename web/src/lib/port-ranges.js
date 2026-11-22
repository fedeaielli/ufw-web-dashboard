/**
 * Port ranges from the IANA assignment. UFW scans mostly hit high ports, so a
 * "top 5 ports + Other" donut ends up mostly grey. Ranges always tell the truth.
 */
export const PORT_RANGES = [
  { key: "well-known", label: "Well-known", min: 0, max: 1023 },
  { key: "registered", label: "Registered", min: 1024, max: 49151 },
  { key: "ephemeral", label: "Ephemeral", min: 49152, max: 65535 },
]

/**
 * @param {string | number} port
 * @returns {string | null}
 */
export function portRange(port) {
  const value = Number(port)
  if (!Number.isFinite(value) || value < 0 || value > 65535) return null
  const range = PORT_RANGES.find((item) => value <= item.max)
  return range ? range.key : null
}

/**
 * @param {Record<string, number>} byPort
 * @returns {Array<{key: string, label: string, count: number, percent: number}>}
 */
export function portRangeCounts(byPort = {}) {
  const counts = new Map(PORT_RANGES.map((item) => [item.key, 0]))
  for (const [port, count] of Object.entries(byPort)) {
    const key = portRange(port)
    if (key) counts.set(key, counts.get(key) + Number(count))
  }
  const total = [...counts.values()].reduce((sum, value) => sum + value, 0)
  if (total === 0) return []

  return PORT_RANGES
    .filter((item) => counts.get(item.key) > 0)
    .map((item) => ({
      key: item.key,
      label: item.label,
      count: counts.get(item.key),
      percent: Math.round((counts.get(item.key) / total) * 100),
    }))
}
