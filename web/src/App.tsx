import { useEffect, useState, type ReactNode } from "react"
import { SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/theme-provider"
import { AppShell } from "@/components/app-shell"
import { LoginPage } from "@/pages/login"
import { OverviewPage } from "@/pages/overview"
import { RulesPage } from "@/pages/rules"
import { ActivityPage } from "@/pages/activity"
import { SettingsPage } from "@/pages/settings"
import { useDashboard } from "@/hooks/use-dashboard"
import type { Dashboard } from "@/hooks/use-dashboard"
import type { TabName } from "@/lib/types"

const TABS: TabName[] = ["overview", "rules", "activity", "settings"]

function useLocation() {
  const [path, setPath] = useState(window.location.pathname)
  const [hash, setHash] = useState(window.location.hash.slice(1))

  useEffect(() => {
    const sync = () => {
      setPath(window.location.pathname)
      setHash(window.location.hash.slice(1))
    }
    window.addEventListener("popstate", sync)
    window.addEventListener("hashchange", sync)
    return () => {
      window.removeEventListener("popstate", sync)
      window.removeEventListener("hashchange", sync)
    }
  }, [])

  return { path, hash }
}

function Dashboard({ hash }: { hash: string }) {
  const dashboard = useDashboard()
  const [tab, setTab] = useState<TabName>(() =>
    TABS.includes(hash as TabName) ? (hash as TabName) : "overview",
  )

  const changeTab = (next: TabName) => {
    setTab(next)
    window.history.replaceState(null, "", `#${next}`)
  }

  const page: Record<TabName, ReactNode> = {
    overview: <OverviewPage dashboard={dashboard} onTab={changeTab} />,
    rules: <RulesPage dashboard={dashboard} />,
    activity: <ActivityPage dashboard={dashboard} onTab={changeTab} />,
    settings: <SettingsPage dashboard={dashboard} />,
  }

  return (
    <SidebarProvider>
      <AppShell tab={tab} onTab={changeTab} dashboard={dashboard}>
        {page[tab]}
      </AppShell>
    </SidebarProvider>
  )
}

function Routes() {
  const { path, hash } = useLocation()
  return path === "/login" ? <LoginPage /> : <Dashboard hash={hash} />
}

export default function App() {
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={200}>
        <Routes />
        <Toaster richColors closeButton position="bottom-right" />
      </TooltipProvider>
    </ThemeProvider>
  )
}
