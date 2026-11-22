import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { motion, useReducedMotion } from "motion/react"
import { Button } from "@/components/ui/button"
import { SPRING } from "@/lib/motion"

export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const reduce = useReducedMotion()
  const dark = resolvedTheme === "dark"

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="relative shrink-0"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      <motion.span
        key={dark ? "moon" : "sun"}
        initial={{ opacity: 0, scale: reduce ? 1 : 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={reduce ? { duration: 0.15 } : SPRING}
        className="grid place-items-center"
      >
        {dark
          ? <Moon className="size-4" strokeWidth={1.5} />
          : <Sun className="size-4" strokeWidth={1.5} />}
      </motion.span>
    </Button>
  )
}
