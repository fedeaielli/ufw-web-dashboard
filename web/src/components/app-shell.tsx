import { useState, type ReactNode } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  Activity, AlertTriangle, BarChart3, ClipboardList, LayoutDashboard,
  LogOut, RefreshCw, Settings, ShieldCheck, ShieldX,
} from "lucide-react"
import { toast } from "sonner"
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarRail, SidebarTrigger,
} from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ModeToggle } from "@/components/mode-toggle"
import { SPRING } from "@/lib/motion"
import { STATUS, format } from "@/lib/logic"
import { mutate } from "@/lib/api"
import type { Dashboard } from "@/hooks/use-dashboard"
import type { FirewallStatus, TabName } from "@/lib/types"

const NAV: { name: TabName; label: string; icon: typeof LayoutDashboard }[] = [
  { name: "overview", label: "Overview", icon: LayoutDashboard },
  { name: "rules", label: "Rules", icon: ClipboardList },
  { name: "activity", label: "Activity", icon: Activity },
  { name: "settings", label: "Settings", icon: Settings },
]

const TITLES: Record<TabName, { title: string; subtitle: string }> = {
  overview: { title: "Overview", subtitle: "Firewall state and blocked traffic at a glance." },
  rules: { title: "Rules", subtitle: "Inbound rules enforced by UFW on this host." },
  activity: { title: "Activity", subtitle: "Blocked connections from the selected log range." },
  settings: { title: "Settings", subtitle: "Log analysis range and current system values." },
}

function StatusPill({ status }: { status: FirewallStatus | null }) {
  const reduce = useReducedMotion()
  const current = STATUS[status || ""] || { tone: "muted", label: "Loading…" }
  const dot = {
    success: "bg-[var(--success)]",
    danger: "bg-[var(--destructive)]",
    warn: "bg-[var(--warn)]",
    muted: "bg-muted-foreground",
  }[current.tone] || "bg-muted-foreground"

  return (
    <Badge variant="outline" className="gap-2 rounded-full px-2.5 py-1 font-normal group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-lg group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:px-0">
      <motion.span
        key={current.tone}
        initial={{ opacity: 0, scale: reduce ? 1 : 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={reduce ? { duration: 0.15 } : SPRING}
        className={`size-1.5 rounded-full ${dot}`}
        aria-hidden="true"
      />
      <span className="num group-data-[collapsible=icon]:hidden">{current.label}</span>
    </Badge>
  )
}

function Banner({ dashboard }: { dashboard: Dashboard }) {
  const { status, error, load, setFirewall } = dashboard
  const variants: Record<string, { kind: "danger" | "warn"; icon: typeof ShieldX; title: string; text: string }> = {
    inactive: {
      kind: "danger" as const, icon: ShieldX, title: "Firewall is off",
      text: "All inbound traffic is allowed. Enable UFW to start enforcing your rules.",
    },
    not_installed: {
      kind: "warn" as const, icon: AlertTriangle, title: "UFW is not installed",
      text: "Install it on the host, then retry: sudo apt install ufw",
    },
    permission_denied: {
      kind: "warn" as const, icon: AlertTriangle, title: "Permission denied",
      text: "The server cannot run ufw. Run it as root, or give the container NET_ADMIN.",
    },
    error: {
      kind: "danger" as const, icon: AlertTriangle, title: "Could not read firewall status",
      text: error || "Unknown error",
    },
  }
  const variant = variants[status || ""]

  if (!variant) return null
  const Icon = variant.icon

  return (
    <motion.div
      role="status"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING}
      data-kind={variant.kind}
      className="mx-4 mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-card px-4 py-3 data-[kind=danger]:border-[var(--destructive)]/30 data-[kind=warn]:border-[var(--warn)]/30 sm:mx-6"
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{variant.title}</p>
        <p className="text-xs text-muted-foreground">{variant.text}</p>
      </div>
      <div className="flex gap-2">
        {status === "inactive" && (
          <Button size="sm" onClick={() => setFirewall(true).then(() => toast.success("Firewall enabled")).catch((e) => toast.error(e.message))}>
            Enable
          </Button>
        )}
        {status !== "inactive" && (
          <Button size="sm" variant="outline" onClick={() => void load()}>Retry</Button>
        )}
      </div>
    </motion.div>
  )
}

interface ShellProps {
  tab: TabName
  onTab: (tab: TabName) => void
  dashboard: Dashboard
  children: ReactNode
}

export function AppShell({ tab, onTab, dashboard, children }: ShellProps) {
  const { status, rules, load, setFirewall } = dashboard
  const [confirmDisable, setConfirmDisable] = useState(false)
  const meta = TITLES[tab]
  const openRules = rules.filter((rule) => rule.action.startsWith("ALLOW")).length
  const canToggle = status === "active" || status === "inactive"

  const onToggle = (checked: boolean) => {
    if (!checked) {
      setConfirmDisable(true)
      return
    }
    void setFirewall(true).then(() => toast.success("Firewall enabled")).catch((e) => toast.error(e.message))
  }

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex h-14 items-center gap-2.5 px-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
              <ShieldCheck className="size-4" strokeWidth={1.5} aria-hidden="true" />
            </span>
            <div className="grid min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate text-sm font-semibold">Firewall</span>
              <span className="truncate text-[11px] font-medium text-faint">UFW console</span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Monitor</SidebarGroupLabel>
            <SidebarGroupContent className="mt-2">
              <SidebarMenu>
                {NAV.map((item) => (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      isActive={tab === item.name}
                      onClick={() => onTab(item.name)}
                      tooltip={item.label}
                    >
                      <item.icon className="size-4" strokeWidth={1.5} />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <div className="flex items-center gap-2 px-2 group-data-[collapsible=icon]:justify-center">
            <StatusPill status={status} />
            <span className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
              {format(openRules)} open
            </span>
          </div>
          <div className="flex items-center gap-1 px-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:px-0">
            <ModeToggle />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Sign out"
              onClick={() => {
                void mutate("/logout", "POST")
                  .catch(() => undefined)
                  .finally(() => { window.location.href = "/login" })
              }}
            >
              <LogOut className="size-4" strokeWidth={1.5} />
            </Button>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6">
          <SidebarTrigger className="-ml-1" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-medium">{meta.title}</h1>
          </div>
          <StatusPill status={status} />
          <span className="sr-only" id="fw-switch-label">Firewall enabled</span>
          <Switch
            checked={status === "active"}
            disabled={!canToggle}
            onCheckedChange={onToggle}
            aria-labelledby="fw-switch-label"
          />
          <Button
            variant="ghost"
            size="icon"
            className="size-9"
            aria-label="Refresh data"
            onClick={() => {
              void load().then(() => toast.success("Data refreshed")).catch((e) => toast.error(e.message))
            }}
          >
            <RefreshCw className="size-4" />
          </Button>
        </header>

        <Banner dashboard={dashboard} />

        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <p className="mb-6 text-sm text-muted-foreground">{meta.subtitle}</p>
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </SidebarInset>

      <AlertDialog open={confirmDisable} onOpenChange={setConfirmDisable}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable the firewall?</AlertDialogTitle>
            <AlertDialogDescription>
              All inbound traffic will be allowed until you enable UFW again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                void setFirewall(false)
                  .then(() => toast.success("Firewall disabled"))
                  .catch((e) => toast.error(e.message))
              }}
            >
              Disable
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
