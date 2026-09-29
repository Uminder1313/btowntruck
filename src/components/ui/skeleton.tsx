import * as React from "react"
import { cn } from "@/components/auth/lib/utils"

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  animated?: boolean
}

function Skeleton({
  className,
  animated = true,
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-md bg-muted/70",
        animated && "animate-pulse",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
