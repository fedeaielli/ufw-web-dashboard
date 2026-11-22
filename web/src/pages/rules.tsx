import { useState, type FormEvent } from "react"
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  distinctServices, familyLabel, format, mergeRules, portName, protocolLabel, sortRules,
} from "@/lib/logic"
import type { Dashboard } from "@/hooks/use-dashboard"
import type { MergedRule } from "@/lib/types"

type SortKey = "port" | "action" | "protocol"

export function RulesPage({ dashboard }: { dashboard: Dashboard }) {
  const { rules, loading, addRule, removeRule } = dashboard
  const [port, setPort] = useState("")
  const [protocol, setProtocol] = useState("both")
  const [type, setType] = useState("allow")
  const [busy, setBusy] = useState(false)
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "port", direction: "asc" })
  const [pendingRemove, setPendingRemove] = useState<MergedRule | null>(null)
  const [pendingDeny, setPendingDeny] = useState(false)

  const groups = sortRules(mergeRules(rules), sort.key, sort.direction)
  const open = groups.filter((group) => group.action.startsWith("ALLOW")).length
  const v6 = groups.filter((group) => group.v6).length

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (type === "deny") {
      setPendingDeny(true)
      return
    }
    await createRule()
  }

  const createRule = async () => {
    setBusy(true)
    try {
      await addRule(Number(port), protocol, type)
      toast.success(type === "deny" ? "Deny rule added" : "Rule added")
      setPort("")
      setPendingDeny(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add rule")
    } finally {
      setBusy(false)
    }
  }

  const doRemove = async () => {
    if (!pendingRemove) return
    const target = pendingRemove
    setPendingRemove(null)
    try {
      await removeRule(target.ids)
      toast.success("Rule removed")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove rule")
    }
  }

  const toggleSort = (key: SortKey) => {
    setSort((current) => current.key === key
      ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
      : { key, direction: "asc" })
  }

  const sortHeader = (key: SortKey, label: string) => (
    <TableHead aria-sort={sort.key === key ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort(key)}>
        {label}
        {sort.key === key && (sort.direction === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </TableHead>
  )

  return (
    <div className="grid gap-4">
      <section className="grid gap-4 sm:grid-cols-3" aria-label="Rule summary">
        {[
          { label: "Open ports", value: open },
          { label: "IPv6 rules", value: v6 },
          { label: "Known services", value: distinctServices(groups) },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="grid gap-1 p-4">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="num text-xl font-semibold">{format(item.value)}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Inbound rules</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
            <div className="grid gap-2">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port" type="number" min={1} max={65535} inputMode="numeric"
                placeholder="443" required value={port}
                onChange={(event) => setPort(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="protocol">Protocol</Label>
              <Select value={protocol} onValueChange={setProtocol}>
                <SelectTrigger id="protocol"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">TCP + UDP</SelectItem>
                  <SelectItem value="tcp">TCP</SelectItem>
                  <SelectItem value="udp">UDP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="type">Action</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="allow">Allow</SelectItem>
                  <SelectItem value="deny">Deny</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={busy} className="w-full sm:w-auto">
              <Plus className="size-4" /> Add rule
            </Button>
          </form>

          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  {sortHeader("port", "Port")}
                  <TableHead className="hidden md:table-cell">Service</TableHead>
                  {sortHeader("action", "Action")}
                  {sortHeader("protocol", "Protocol")}
                  <TableHead className="hidden md:table-cell">Family</TableHead>
                  <TableHead><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 4 }, (_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : groups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      No rules yet. Add a port above to allow it.
                    </TableCell>
                  </TableRow>
                ) : groups.map((group) => (
                  <TableRow key={group.key}>
                    <TableCell className="num font-medium">
                      {group.port}
                      {group.from !== "Anywhere" && (
                        <span className="block text-xs font-normal text-muted-foreground">from {group.from}</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {portName(group.port) || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={group.action.startsWith("ALLOW") ? "default" : "destructive"}>
                        {group.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {protocolLabel(group.proto)}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{familyLabel(group)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive"
                        aria-label={`Remove rule for port ${group.port}`}
                        onClick={() => setPendingRemove(group)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="num text-xs text-muted-foreground">{groups.length} {groups.length === 1 ? "rule" : "rules"}</p>
        </CardContent>
      </Card>

      <AlertDialog open={pendingDeny} onOpenChange={setPendingDeny}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deny port {port}?</AlertDialogTitle>
            <AlertDialogDescription>
              Deny rules can lock you out of services you rely on, including SSH. Keep another way in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void createRule()}>Add deny rule</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(pendingRemove)} onOpenChange={(open) => { if (!open) setPendingRemove(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove rule for port {pendingRemove?.port}?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemove && pendingRemove.ids.length > 1
                ? `This deletes ${pendingRemove.ids.length} rules (IPv4 and IPv6).`
                : "This rule will be deleted immediately."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void doRemove()}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
