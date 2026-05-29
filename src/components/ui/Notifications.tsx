import { useEffect } from "react"
import { useGameStore } from "../../core/gameStore"

export function Notifications() {
  const allNotifications = useGameStore((s) => s.notifications)
  const remove = useGameStore((s) => s.removeNotification)

  useEffect(() => {
    if (allNotifications.length === 0) return

    // ¡La solución aquí! Si hay más de 4 notificaciones en el store,
    // eliminamos inmediatamente las más viejas (las primeras del array)
    // para dar paso a las nuevas sin esperar a que termine su temporizador.
    if (allNotifications.length > 4) {
      const excessCount = allNotifications.length - 4
      for (let i = 0; i < excessCount; i++) {
        remove(allNotifications[i].id)
      }
      return
    }

    const timers = allNotifications.map((n) =>
      window.setTimeout(() => remove(n.id), 1500),
    )

    return () => timers.forEach(clearTimeout)
  }, [allNotifications, remove])

  const displayedNotifications = allNotifications.slice(0, 4)

  return (
    // z-[100] para flotar SIEMPRE por encima del modal de crafteo (z-50),
    // del backdrop blur del modal, del loader (z-40) y de cualquier
    // overlay de la escena. Bug Visual Sprint 1/2: las notificaciones
    // ("Ingrediente anadido" / "Mezcla fallida") se cargaban debajo
    // del modal por la combinacion de stacking context + backdrop-blur.
    // Subir a z-[100] garantiza que el contenedor no queda atrapado.
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2">
      {displayedNotifications.map((n) => (
        <div
          key={n.id}
          className={`pointer-events-auto rounded-md border px-4 py-2 text-sm font-medium shadow-lg backdrop-blur ${n.kind === "success"
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
