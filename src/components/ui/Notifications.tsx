import { useEffect } from "react"
import { useGameStore } from "../../core/gameStore"

export function Notifications() {
  const notifications = useGameStore((s) => s.notifications)
  const remove = useGameStore((s) => s.removeNotification)

  useEffect(() => {
    if (notifications.length === 0) return
    const timers = notifications.map((n) =>
      window.setTimeout(() => remove(n.id), 3000),
    )
    return () => timers.forEach(clearTimeout)
  }, [notifications, remove])

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 flex-col items-center gap-2">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`pointer-events-auto rounded-md border px-4 py-2 text-sm font-medium shadow-lg backdrop-blur ${
            n.kind === "success"
              ? "border-primary/50 bg-primary/20 text-primary"
              : n.kind === "error"
                ? "border-destructive/50 bg-destructive/20 text-destructive"
                : "border-border bg-card text-card-foreground"
          }`}
        >
          {n.message}
        </div>
      ))}
    </div>
  )
}
