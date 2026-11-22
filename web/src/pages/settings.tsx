import { useState, type FormEvent } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ModeToggle } from "@/components/mode-toggle"
import { STATUS, format, mergeRules } from "@/lib/logic"
import type { Dashboard } from "@/hooks/use-dashboard"

export function SettingsPage({ dashboard }: { dashboard: Dashboard }) {
  const { status, rules, logs, myIp, lines, setLines, load } = dashboard
  const [value, setValue] = useState(String(lines))
  const groups = mergeRules(rules)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const next = Number(value)
    if (!Number.isFinite(next) || next < 100 || next > logs.maxLines) {
      toast.error(`Enter a value between 100 and ${logs.maxLines}`)
      return
    }
    setLines(next)
    void load(next).then(() => toast.success("Log range applied and data refreshed")).catch((error) => toast.error(error.message))
  }

  const system = [
    { label: "Firewall", value: (STATUS[status || ""] || { label: "Unknown" }).label },
    { label: "Open rules", value: format(groups.filter((group) => group.action.startsWith("ALLOW")).length) },
    { label: "Blocked attempts", value: format(logs.total) },
    { label: "Source IPs", value: format(Object.keys(logs.byIp).length) },
    { label: "Your IP", value: myIp || "—" },
  ]

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Log analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={submit}>
            <div className="grid gap-2">
              <Label htmlFor="lines">Log lines to analyze</Label>
              <div className="flex gap-2">
                <Input
                  id="lines" type="number" min={100} max={logs.maxLines} step={100} inputMode="numeric"
                  value={value} onChange={(event) => setValue(event.target.value)} required
                />
                <Button type="submit">Apply &amp; refresh</Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Analyzing the last {format(lines)} lines · server reads up to {format(logs.maxLines)}.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">System</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3">
            {system.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-4 text-sm">
                <dt className="text-muted-foreground">{item.label}</dt>
                <dd className="num font-medium">{item.value}</dd>
              </div>
            ))}
          </dl>
          <Separator className="my-4" />
          <div className="flex items-center justify-between gap-4 text-sm">
            <div>
              <p className="font-medium">Appearance</p>
              <p className="text-xs text-muted-foreground">Dark and light themes. Reduced motion is respected automatically.</p>
            </div>
            <ModeToggle />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
