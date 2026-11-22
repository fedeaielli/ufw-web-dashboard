import type { ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AreaChart } from "@/components/charts/area-chart"
import { Area } from "@/components/charts/area"
import { Grid } from "@/components/charts/grid"
import { XAxis } from "@/components/charts/x-axis"
import { PieChart } from "@/components/charts/pie-chart"
import { PieSlice } from "@/components/charts/pie-slice"
import { PieCenter } from "@/components/charts/pie-center"
import { format, groupCounts, donutSlices, mergeRules, portName, protocolStats, serviceCategories } from "@/lib/logic"
import { SPRING } from "@/lib/motion"
import type { Dashboard } from "@/hooks/use-dashboard"
import type { TabName } from "@/lib/types"

const COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)",
  "var(--chart-4)", "var(--chart-5)", "var(--faint)",
]

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>
}

interface Props {
  dashboard: Dashboard
  onTab: (tab: TabName) => void
}

export function OverviewPage({ dashboard, onTab }: Props) {
  const { rules, logs, lines, setFilterIp } = dashboard
  const openPorts = mergeRules(rules).filter((group) => group.action.startsWith("ALLOW")).length
  const sourceIps = Object.keys(logs.byIp).length
  const targetedPorts = Object.keys(logs.byPort).length

  const series = (logs.series || []).map((point) => ({ date: new Date(point.t), count: point.count }))
  const { slices, total } = donutSlices(logs.byPort, 5)
  const protocols = protocolStats(logs.byProto)
  const sources = groupCounts(logs.byIp, 5)
  const categories = serviceCategories(logs.byPort)

  return (
    <div className="grid gap-4">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Key metrics">
        <Card>
          <CardContent className="grid gap-1 p-4">
            <p className="text-xs text-muted-foreground">Open ports</p>
            <p className="num text-2xl font-medium leading-none">{format(openPorts)}</p>
            <p className="text-xs text-faint">inbound allow rules</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="grid gap-1 p-4">
            <p className="text-xs text-muted-foreground">Blocked attempts</p>
            <p className="num text-2xl font-medium leading-none">{format(logs.total)}</p>
            <p className="text-xs text-faint">last {format(lines)} log lines</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="grid gap-1 p-4">
            <p className="text-xs text-muted-foreground">Source IPs</p>
            <p className="num text-2xl font-medium leading-none">{format(sourceIps)}</p>
            <p className="text-xs text-faint">external addresses</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="grid gap-1 p-4">
            <p className="text-xs text-muted-foreground">Targeted ports</p>
            <p className="num text-2xl font-medium leading-none">{format(targetedPorts)}</p>
            <p className="text-xs text-faint">ports hit by scans</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Blocked attempts by log order</CardTitle>
          <span className="num text-xs text-muted-foreground">
            {series.length ? `${format(logs.total)} attempts` : "no data"}
          </span>
        </CardHeader>
        <CardContent className="h-80 px-2 pb-4 sm:px-4">
          {series.length ? (
            <AreaChart data={series} xDataKey="date" animationDuration={300} enterTransition={SPRING} style={{ aspectRatio: "auto", height: "100%" }}>
              <Grid horizontal vertical={false} />
              <Area dataKey="count" fill="var(--chart-1)" stroke="var(--chart-1)" fillOpacity={0.25} />
              <XAxis />
            </AreaChart>
          ) : <Empty>No blocked attempts in range.</Empty>}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Targeted ports</CardTitle>
            <span className="num text-xs text-muted-foreground">{targetedPorts} ports</span>
          </CardHeader>
          <CardContent>
            {total === 0 ? <Empty>No blocked attempts in range.</Empty> : (
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <PieChart data={slices.map((slice, index) => ({
                  label: slice.key === "Other" ? "Other" : (portName(slice.key) || slice.key),
                  value: slice.count,
                  color: COLORS[index % COLORS.length],
                }))} innerRadius={52} padAngle={0.02} size={168} enterTransition={SPRING} enterStaggerScale={0} className="shrink-0">
                  {slices.map((slice, index) => (
                    <PieSlice key={slice.key} index={index} color={COLORS[index % COLORS.length]} />
                  ))}
                  <PieCenter defaultLabel="blocked" />
                </PieChart>
                <ul className="grid w-full gap-2">
                  {slices.map((slice, index) => (
                    <li key={slice.key} className="flex items-center gap-2 text-xs">
                      <span className="size-2 rounded-full" style={{ background: COLORS[index % COLORS.length] }} />
                      <span className="num font-medium">{slice.key}</span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {slice.key === "Other" ? "remaining ports" : (portName(slice.key) || "unknown")}
                      </span>
                      <span className="num text-muted-foreground">{format(slice.count)}</span>
                      <span className="num w-8 text-right text-faint">{Math.round(slice.percent)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Protocols</CardTitle>
            <span className="num text-xs text-muted-foreground">
              {format(protocols.reduce((sum, entry) => sum + entry.count, 0))} attempts
            </span>
          </CardHeader>
          <CardContent className="grid gap-4">
            {protocols.length === 0 ? <Empty>No protocol data in range.</Empty> : (
              <>
                <div className="flex h-2 overflow-hidden rounded-full bg-secondary" role="img" aria-label="Protocol share">
                  {protocols.map((entry, index) => (
                    <span
                      key={entry.name}
                      style={{ width: `${entry.percent}%`, background: COLORS[index % 2] }}
                      title={`${entry.name}: ${format(entry.count)} (${entry.percent}%)`}
                    />
                  ))}
                </div>
                <ul className="grid gap-2">
                  {protocols.map((entry, index) => (
                    <li key={entry.name} className="flex items-center gap-2 text-xs">
                      <span className="size-2 rounded-full" style={{ background: COLORS[index % 2] }} />
                      <span className="font-medium">{entry.name}</span>
                      <span className="num ml-auto text-muted-foreground">{format(entry.count)}</span>
                      <span className="num w-8 text-right text-faint">{entry.percent}%</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top sources</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onTab("activity")}>View activity</Button>
          </CardHeader>
          <CardContent>
            {sources.length === 0 ? <Empty>No external sources in range.</Empty> : (
              <ul className="grid gap-1">
                {sources.map(({ key, count }, index) => (
                  <li key={key}>
                    <button
                      type="button"
                      className="grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-lg px-2 py-2 text-left hover:bg-accent"
                      onClick={() => { setFilterIp(key); onTab("activity") }}
                    >
                      <span className="num truncate text-xs font-medium">{key}</span>
                      <span className="num text-xs text-muted-foreground">{format(count)}</span>
                      <span className="col-span-2 h-1 overflow-hidden rounded-full bg-secondary">
                        <span
                          className={`block h-full rounded-full ${index === 0 ? "bg-primary" : "bg-foreground/20"}`}
                          style={{ width: `${Math.max(4, Math.round((count / sources[0].count) * 100))}%` }}
                        />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Service categories</CardTitle>
            <span className="num text-xs text-muted-foreground">{categories.length} groups</span>
          </CardHeader>
          <CardContent>
            {categories.length === 0 ? <Empty>No blocked attempts in range.</Empty> : (
              <ul className="grid gap-3">
                {categories.map((entry, index) => (
                  <li key={entry.name} className="grid gap-1">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-medium">{entry.name}</span>
                      <span className="num text-muted-foreground">{format(entry.count)} · {entry.percent}%</span>
                    </div>
                    <span className="h-1 overflow-hidden rounded-full bg-secondary">
                      <span className={`block h-full rounded-full ${index === 0 ? "bg-primary" : "bg-foreground/20"}`} style={{ width: `${Math.max(4, entry.percent)}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
