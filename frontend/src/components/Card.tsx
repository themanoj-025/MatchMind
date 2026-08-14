import * as React from "react"
import { motion, useMotionTemplate, useMotionValue } from "framer-motion"
import { cn } from "../lib/utils"

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "glass" | "gradient"
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    const mouseX = useMotionValue(0)
    const mouseY = useMotionValue(0)

    function handleMouseMove({
      currentTarget,
      clientX,
      clientY,
    }: React.MouseEvent<HTMLDivElement>) {
      const { left, top } = currentTarget.getBoundingClientRect()
      mouseX.set(clientX - left)
      mouseY.set(clientY - top)
    }

    return (
      <div
        className={cn(
          "group relative rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.08] to-white/[0.02] shadow-card transition-shadow hover:shadow-card-hover",
          {
            "backdrop-blur-xl bg-white/[0.03]": variant === "glass",
            "bg-gradient-to-br from-white/[0.08] via-white/[0.02] to-accent/10": variant === "gradient",
          },
          className
        )}
        onMouseMove={handleMouseMove}
        ref={ref}
        {...props}
      >
        <motion.div
          className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition duration-300 group-hover:opacity-100"
          style={{
            background: useMotionTemplate`
              radial-gradient(
                300px circle at ${mouseX}px ${mouseY}px,
                rgba(94,106,210,0.15),
                transparent 80%
              )
            `,
          }}
        />
        {/* Inner highlight */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl shadow-inner-highlight" />
        <div className="relative z-10 h-full">{children}</div>
      </div>
    )
  }
)
Card.displayName = "Card"
