/**
 * UFW logs carry only HH:MM:SS. `new Date("18:45:00")` is Invalid Date, which
 * makes the chart's date formatter throw. Build a monotonic synthetic date
 * from the time when present, and from the index for any other format.
 * @param {string | undefined} t
 * @param {number} index
 * @returns {Date}
 */
export function chartDate(t, index) {
  const match = /^(\d{2}):(\d{2}):(\d{2})$/.exec(t || "")
  return match
    ? new Date(Date.UTC(2026, 0, 1, Number(match[1]), Number(match[2]), Number(match[3])))
    : new Date(Date.UTC(2026, 0, 1, 0, index))
}
