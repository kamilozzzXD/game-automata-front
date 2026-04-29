import { useEffect } from "react"
import { useGameStore } from "../../core/gameStore"

export function Notifications() {
  const notifications = useGameStore((s) => s.notifications)
  const remove = useGameStore((s) => s.removeNotification)

  useEffect(() => {
    if (notifications.length === 0) return
    // Timeout reducido a la mitad (3s -> 1.5s) para que la pila de notificaciones
    // no sature la pantalla cuando el jugador hace clics rapidos en el caldero.
    const timers = notifications.map((n) =>
      window.setTimeout(() => remove(n.id), 1500),
    )
    return () => timers.forEach(clearTimeout)
  }, [notifications, remove])

  return (
    // z-[60] para flotar SIEMPRE por encima del modal de crafteo (z-50)
    // y de cualquier overlay de la escena. Asi las notificaciones de
    // "Ingrediente anadido" / "Mezcla fallida" son legibles incluso con
    // el caldero abierto.
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
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
