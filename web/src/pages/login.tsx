import { useState, type FormEvent } from "react"
import { motion, useReducedMotion } from "motion/react"
import { Eye, EyeOff, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { SPRING } from "@/lib/motion"

export function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [show, setShow] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const reduce = useReducedMotion()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/login", {
        method: "POST",
        redirect: "manual",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({ username, password }),
      })
      if (response.type === "opaqueredirect" || response.status === 303) {
        window.location.href = "/"
        return
      }
      const data = await response.json().catch(() => ({}))
      setError(data.error || "Unable to sign in. Please try again.")
    } catch {
      setError("Unable to reach the server. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: reduce ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduce ? { duration: 0.15 } : SPRING}
        className="w-full max-w-sm"
      >
        <Card className="shadow-sm">
          <CardHeader className="items-center gap-3 pb-2 text-center">
            <span className="grid size-11 place-items-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <div className="grid gap-1">
              <h1 className="text-lg font-semibold tracking-[-0.02em]">Firewall Manager</h1>
              <p className="text-sm text-muted-foreground">Sign in to manage UFW on this host.</p>
            </div>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={submit}>
              <div className="grid gap-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username" name="username" autoComplete="username" autoFocus required
                  value={username} onChange={(event) => setUsername(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password" name="password" autoComplete="current-password" required
                    className="pr-10" type={show ? "text" : "password"}
                    value={password} onChange={(event) => setPassword(event.target.value)}
                  />
                  <Button
                    type="button" variant="ghost" size="icon"
                    className="absolute right-0 top-0 size-9 text-muted-foreground"
                    aria-label={show ? "Hide password" : "Show password"}
                    aria-pressed={show}
                    onClick={() => setShow((value) => !value)}
                  >
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                </div>
              </div>
              {error && (
                <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </main>
  )
}
