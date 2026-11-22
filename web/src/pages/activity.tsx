import { useState } from "react"
import { FilterX, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BarChart } from "@/components/charts/bar-chart"
import { Bar } from "@/components/charts/bar"
import { Grid } from "@/components/charts/grid"
import { countsForIp, filterRecent, format, groupCounts, portName } from "@/lib/logic"
import type { Dashboard } from "@/hooks/use-dashboard"
import type { TabName } from "@/lib/types"

const LIMIT = 8

export function ActivityPage({ dashboard, onTab }: { dashboard: Dashboard; onTab: (tab: TabName) => void }) {
  const { logs, lines, myIp, filterIp, setFilterIp, refreshLogs } = dashboard
  const [showAllPorts, setShowAllPorts] = useState(false)
  const [showAllIps, setShowAllIps] = useState(false)

  const counts = countsForIp(logs, filterIp)
  const portEntries = groupCounts(counts, showAllPorts ? Infinity : LIMIT)
  const ipEntries = groupCounts(logs.byIp, showAllIps ? Infinity : LIMIT)
  const recent = filterRecent(logs.recent, filterIp)
  const chartData = portEntries.map((entry) => ({ name: entry.key, count: entry.count }))

  const refresh = () => {
    void refreshLogs().then(() => toast.success("Activity refreshed")).catch((error) => toast.error(error.message))
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Blocked connections from the last <span className="num font-medium text-foreground">{format(lines)}</span> log lines.
        </p>
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCw className="size-4" /> Refresh
        </Button>
      </div>

      {filterIp && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Filtered by source</span>
          <span className="num font-medium">{filterIp}</span>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setFilterIp(null)}>
            <FilterX className="size-4" /> Clear
          </Button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top targeted ports</CardTitle>
            <span className="text-xs text-muted-foreground">{filterIp ? `from ${filterIp}` : "all sources"}</span>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No blocked attempts in range.</p>
            ) : (
              <BarChart data={chartData} xDataKey="name" orientation="horizontal" aspectRatio="2.6 / 1" margin={{ left: 8, right: 24 }}>
                <Grid horizontal={false} vertical />
                <Bar dataKey="count" fill="var(--chart-1)" />
              </BarChart>
            )}
            {Object.keys(counts).length > LIMIT && (
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowAllPorts((value) => !value)}>
                {showAllPorts ? `Show top ${LIMIT}` : `Show all ${Object.keys(counts).length} ports`}
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top source IPs</CardTitle>
            <span className="num text-xs text-muted-foreground">{Object.keys(logs.byIp).length} sources</span>
          </CardHeader>
          <CardContent>
            {ipEntries.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No external sources in range.</p>
            ) : (
              <ul className="grid gap-1">
                {ipEntries.map(({ key, count }) => (
                  <li key={key}>
                    <button
                      type="button"
                      aria-pressed={filterIp === key}
                      className="grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-lg px-2 py-2 text-left hover:bg-accent aria-pressed:bg-primary/10"
                      onClick={() => setFilterIp(filterIp === key ? null : key)}
                    >
                      <span className="num truncate text-xs font-medium">{key}</span>
                      <span className="num text-xs text-muted-foreground">{format(count)}</span>
                      <span className="col-span-2 h-1 overflow-hidden rounded-full bg-secondary">
                        <span className="block h-full rounded-full bg-primary"
                          style={{ width: `${Math.max(4, Math.round((count / ipEntries[0].count) * 100))}%` }} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {Object.keys(logs.byIp).length > LIMIT && (
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowAllIps((value) => !value)}>
                {showAllIps ? `Show top ${LIMIT}` : `Show all ${Object.keys(logs.byIp).length} sources`}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Recent blocked connections</CardTitle>
          <span className="text-xs text-muted-foreground">{filterIp ? `filtered · ${recent.length} of 15` : "last 15"}</span>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden md:table-cell">Time</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Port</TableHead>
                  <TableHead>Protocol</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                      No blocked attempts in the selected range.
                    </TableCell>
                  </TableRow>
                ) : recent.map((entry, index) => (
                  <TableRow key={`${entry.time}-${entry.src}-${entry.port}-${index}`}>
                    <TableCell className="num hidden text-muted-foreground md:table-cell">{entry.time}</TableCell>
                    <TableCell className="num font-medium">
                      {entry.src}
                      {entry.src === myIp && <Badge variant="secondary" className="ml-2">you</Badge>}
                    </TableCell>
                    <TableCell className="num">
                      {entry.port}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">{portName(entry.port)}</span>
                    </TableCell>
                    <TableCell><Badge variant="outline">{entry.protocol || entry.proto || "—"}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Button variant="link" size="sm" className="mt-2 px-0" onClick={() => onTab("settings")}>
            Change log analysis range
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
