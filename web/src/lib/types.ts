export type FirewallStatus =
  | "active"
  | "inactive"
  | "not_installed"
  | "permission_denied"
  | "error"

export interface Rule {
  id: string
  to: string
  action: string
  from: string
}

export interface MergedRule {
  key: string
  port: string
  proto: string
  action: string
  from: string
  v4: boolean
  v6: boolean
  ids: string[]
}

export interface RecentEntry {
  time: string
  src: string
  port: string
  protocol?: string
  proto?: string
}

export interface SeriesPoint {
  t: string
  count: number
}

export interface LogStats {
  byPort: Record<string, number>
  byProto: Record<string, number>
  byIp: Record<string, number>
  ipPorts: Record<string, Record<string, number>>
  recent: RecentEntry[]
  series: SeriesPoint[]
  total: number
  maxLines: number
  defaultLines: number
}

export interface RulesResponse {
  status: FirewallStatus
  rules: Rule[]
  error?: string
}

export interface WhoAmI {
  ip: string
}

export type TabName = "overview" | "rules" | "activity" | "settings"
