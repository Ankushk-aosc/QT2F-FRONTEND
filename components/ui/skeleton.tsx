import React from "react"

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={className} {...props} />
}

export function SkeletonItem({
  size = 16,
  shape = "rounded",
  style,
  ...props
}: {
  size?: number
  shape?: "rounded" | "square" | "circle"
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className="ui-skeleton-item"
      style={{
        height: `${size}px`,
        width: shape === "square" || shape === "circle" ? `${size}px` : "100%",
        borderRadius: shape === "circle" ? "50%" : undefined,
        ...style,
      }}
      {...props}
    />
  )
}
