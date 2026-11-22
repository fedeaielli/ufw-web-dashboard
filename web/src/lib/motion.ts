import type { Transition } from "motion/react"

/** Critically damped, no overshoot. Default for every state change. */
export const SPRING: Transition = { type: "spring", bounce: 0, duration: 0.3 }

/** Only for motion that follows real momentum. No drag exists here yet. */
export const MOMENTUM_SPRING: Transition = { type: "spring", bounce: 0.2, duration: 0.4 }

export const PRESS_TRANSITION: Transition = { duration: 0.12 }
