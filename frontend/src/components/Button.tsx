import * as React from "react"
import { motion, type HTMLMotionProps } from "framer-motion"
import { cn } from "../lib/utils"

export interface ButtonProps extends HTMLMotionProps<"button"> {
  variant?: "primary" | "secondary" | "ghost"
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", children, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] as any }}
        className={cn(
          "relative inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-glow focus-visible:ring-offset-2 focus-visible:ring-offset-background-base overflow-hidden",
          {
            "bg-accent text-white shadow-accent hover:bg-accent-bright": variant === "primary",
            "bg-white/[0.05] text-foreground shadow-inner-highlight hover:bg-white/[0.08] hover:shadow-[0_0_15px_rgba(255,255,255,0.05)] border border-transparent": variant === "secondary",
            "bg-transparent text-foreground-muted hover:bg-white/[0.05] hover:text-foreground": variant === "ghost",
          },
          className
        )}
        {...props}
      >
        <span className="relative z-10 flex items-center gap-2">{children as React.ReactNode}</span>
        {variant === "primary" && (
          <span className="absolute inset-0 rounded-lg bg-[linear-gradient(110deg,transparent_20%,rgba(255,255,255,0.2)_50%,transparent_80%)] bg-[length:200%_100%] animate-none hover:animate-shimmer opacity-0 hover:opacity-100 transition-opacity pointer-events-none" />
        )}
      </motion.button>
    )
  }
)
Button.displayName = "Button"
