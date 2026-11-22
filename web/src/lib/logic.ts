// shortcut: mirrors src/public/logic.js, which is still the test-backed copy.
// Keep both in sync until the logic tests run directly against this module.
import type { LogStats, MergedRule, RecentEntry, Rule } from "./types"

const SERVICES: Record<string, string> = {
  "20": "FTP data", "21": "FTP", "22": "SSH", "23": "Telnet", "25": "SMTP",
  "53": "DNS", "67": "DHCP", "68": "DHCP", "80": "HTTP", "110": "POP3",
  "123": "NTP", "143": "IMAP", "161": "SNMP", "389": "LDAP", "443": "HTTPS",
  "445": "SMB", "465": "SMTPS", "587": "SMTP", "631": "CUPS", "993": "IMAPS",
  "995": "POP3S", "1194": "OpenVPN", "3306": "MySQL", "3389": "RDP",
  "5432": "PostgreSQL", "6379": "Redis", "8080": "HTTP alt",
  "8443": "HTTPS alt", "27017": "MongoDB",
}

export const portName = (port: string | number) => SERVICES[String(port)] || ""

export const format = (value: number | string | undefined) =>
  Number(value ?? 0).toLocaleString("en-US")

export const parseRuleTarget = (to = "") => {
  const v6 = /\(v6\)/.test(to)
  const clean = to.replace("(v6)", "").trim()
  const slash = clean.indexOf("/")
  return {
    port: slash === -1 ? clean : clean.slice(0, slash),
    proto: slash === -1 ? "any" : clean.slice(slash + 1),
    v6,
  }
}

export const mergeRules = (rules: Rule[] = []): MergedRule[] => {
  const groups = new Map<string, MergedRule>()

  for (const rule of rules) {
    const { port, proto, v6 } = parseRuleTarget(rule.to)
    const from = rule.from.replace("(v6)", "").trim()
    const key = [port, proto, rule.action, from].join("|")

    if (!groups.has(key)) {
      groups.set(key, { key, port, proto, action: rule.action, from, v4: false, v6: false, ids: [] })
    }
    const group = groups.get(key)!
    group[v6 ? "v6" : "v4"] = true
    group.ids.push(String(rule.id))
  }

  return [...groups.values()].sort(
    (a, b) => Number(a.port) - Number(b.port) || a.proto.localeCompare(b.proto),
  )
}

const PROTO_ORDER: Record<string, number> = { tcp: 0, udp: 1, any: 2 }

const comparePort = (a: MergedRule, b: MergedRule) => {
  const first = Number(a.port)
  const second = Number(b.port)
  if (Number.isFinite(first) && Number.isFinite(second) && first !== second) return first - second
  return a.port.localeCompare(b.port, undefined, { numeric: true })
}

export const sortRules = (
  groups: MergedRule[] = [],
  key: "port" | "action" | "protocol" = "port",
  direction: "asc" | "desc" = "asc",
) => {
  const compare = {
    action: (a: MergedRule, b: MergedRule) => a.action.localeCompare(b.action),
    protocol: (a: MergedRule, b: MergedRule) =>
      (PROTO_ORDER[a.proto] ?? 3) - (PROTO_ORDER[b.proto] ?? 3),
    port: comparePort,
  }[key]
  const sign = direction === "desc" ? -1 : 1
  return [...groups].sort(
    (a, b) => sign * compare(a, b) || comparePort(a, b) || a.proto.localeCompare(b.proto),
  )
}

export const familyLabel = ({ v4, v6 }: MergedRule) =>
  v4 && v6 ? "v4 + v6" : v6 ? "v6" : "v4"

export const protocolLabel = (proto = "any") =>
  proto === "any" || !proto ? "TCP + UDP" : proto.toUpperCase()

export const groupCounts = (counts: Record<string, number> = {}, limit = 5) =>
  Object.entries(counts)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)

export const donutSlices = (byPort: Record<string, number> = {}, limit = 5) => {
  const total = Object.values(byPort).reduce((sum, count) => sum + count, 0)
  if (total === 0) return { total: 0, slices: [] as { key: string; count: number; percent: number }[] }

  const top = groupCounts(byPort, limit)
  const shown = top.reduce((sum, entry) => sum + entry.count, 0)
  const slices = top.map((entry) => ({ ...entry, percent: (entry.count / total) * 100 }))
  if (total - shown > 0) {
    slices.push({ key: "Other", count: total - shown, percent: ((total - shown) / total) * 100 })
  }
  return { total, slices }
}

export const protocolStats = (byProto: Record<string, number> = {}) => {
  const entries = Object.entries(byProto)
    .map(([name, count]) => ({ name: name.toUpperCase(), count }))
    .sort((a, b) => b.count - a.count)
  const total = entries.reduce((sum, entry) => sum + entry.count, 0)
  return entries.map((entry) => ({
    ...entry,
    percent: total ? Math.round((entry.count / total) * 100) : 0,
  }))
}

const CATEGORIES = [
  { name: "Web", ports: [80, 443, 3000, 8000, 8080, 8443] },
  { name: "Remote access", ports: [22, 23, 3389, 5900] },
  { name: "Mail", ports: [25, 110, 143, 465, 587, 993, 995] },
  { name: "Database", ports: [1433, 1521, 3306, 5432, 6379, 27017] },
  { name: "File sharing", ports: [20, 21, 139, 445, 2049] },
]

export const serviceCategories = (byPort: Record<string, number> = {}) => {
  const total = Object.values(byPort).reduce((sum, count) => sum + count, 0)
  if (total === 0) return []

  const counts = new Map(CATEGORIES.map((category) => [category.name, 0]))
  let other = 0
  for (const [port, count] of Object.entries(byPort)) {
    const category = CATEGORIES.find((item) => item.ports.includes(Number(port)))
    if (category) counts.set(category.name, counts.get(category.name)! + count)
    else other += count
  }
  if (other > 0) counts.set("Other", other)

  return [...counts.entries()]
    .filter(([, count]) => count > 0)
    .map(([name, count]) => ({ name, count, percent: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count)
}

export const distinctServices = (groups: MergedRule[] = []) =>
  new Set(groups.map((group) => portName(group.port)).filter(Boolean)).size

export const countsForIp = (logs: LogStats, ip: string | null) =>
  (ip && logs.ipPorts?.[ip]) || logs.byPort || {}

export const filterRecent = (recent: RecentEntry[] = [], ip: string | null = null) =>
  ip ? recent.filter((entry) => entry.src === ip) : recent

export const STATUS: Record<string, { tone: string; label: string }> = {
  active: { tone: "success", label: "Active" },
  inactive: { tone: "danger", label: "Inactive" },
  not_installed: { tone: "warn", label: "Not installed" },
  permission_denied: { tone: "warn", label: "No permission" },
  error: { tone: "warn", label: "Error" },
}
