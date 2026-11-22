import { useCallback, useEffect, useState } from "react"
import { api, mutate } from "@/lib/api"
import type { FirewallStatus, LogStats, Rule, RulesResponse, WhoAmI } from "@/lib/types"

const EMPTY_LOGS: LogStats = {
  byPort: {}, byProto: {}, byIp: {}, ipPorts: {}, recent: [], series: [],
  total: 0, maxLines: 10000, defaultLines: 1000,
}

const storedLines = () => {
  const value = Number(localStorage.getItem("logLines") || localStorage.getItem("logMaxLines"))
  return Number.isFinite(value) && value >= 100 ? value : 1000
}

export function useDashboard() {
  const [status, setStatus] = useState<FirewallStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rules, setRules] = useState<Rule[]>([])
  const [logs, setLogs] = useState<LogStats>(EMPTY_LOGS)
  const [myIp, setMyIp] = useState<string | null>(null)
  const [filterIp, setFilterIp] = useState<string | null>(null)
  const [lines, setLinesState] = useState<number>(storedLines)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rulesData, logsData, who] = await Promise.all([
        api<RulesResponse>("/api/rules"),
        api<LogStats>(`/api/logs?lines=${lines}`),
        api<WhoAmI>("/api/whoami"),
      ])
      setStatus(rulesData.status)
      setError(rulesData.error || null)
      setRules(rulesData.rules || [])
      setLogs(logsData)
      setMyIp(who.ip)
    } finally {
      setLoading(false)
    }
  }, [lines])

  useEffect(() => {
    void load()
  }, [load])

  const refreshLogs = useCallback(async () => {
    setLogs(await api<LogStats>(`/api/logs?lines=${lines}`))
  }, [lines])

  const setFirewall = useCallback(async (enabled: boolean) => {
    await mutate(enabled ? "/api/rules/enable" : "/api/rules/disable", "POST")
    setStatus(enabled ? "active" : "inactive")
  }, [])

  const addRule = useCallback(async (port: number, protocol: string, type: string) => {
    await mutate("/api/rules", "POST", { port, protocol, type })
    const data = await api<RulesResponse>("/api/rules")
    setRules(data.rules || [])
    setStatus(data.status)
  }, [])

  const removeRule = useCallback(async (ids: string[]) => {
    // ufw renumbers after each delete, so remove the highest ids first.
    const ordered = [...ids].map(Number).sort((a, b) => b - a)
    for (const id of ordered) {
      await mutate(`/api/rules/${id}`, "DELETE")
    }
    const data = await api<RulesResponse>("/api/rules")
    setRules(data.rules || [])
    setStatus(data.status)
  }, [])

  const setLines = useCallback((value: number) => {
    localStorage.setItem("logLines", String(value))
    setLinesState(value)
  }, [])

  return {
    status, error, rules, logs, myIp, filterIp, lines, loading,
    load, refreshLogs, setFirewall, addRule, removeRule, setLines, setFilterIp,
  }
}

export type Dashboard = ReturnType<typeof useDashboard>
