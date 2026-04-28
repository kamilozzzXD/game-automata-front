import { useEffect, useMemo, useState } from "react"
import { GiPineTree } from "react-icons/gi"
import { Cauldron } from "../components/game/Cauldron"
import { Player } from "../components/game/Player"
import { CraftingModal } from "../components/ui/CraftingModal"
import { HUD } from "../components/ui/HUD"
import { Notifications } from "../components/ui/Notifications"
import { useGameStore } from "../core/gameStore"
import { isWithinRadius } from "../core/geometry"
import { useGameKeyboard } from "../hooks/useGameKeyboard"
import { usePlayerMovement } from "../hooks/usePlayerMovement"
import type { Interactable, Size } from "../types/game"

const WORLD_SIZE: Size = { width: 960, height: 600 }
const PLAYER_SIZE: Size = { width: 48, height: 48 }

const CAULDRON: Interactable = {
  id: "cauldron-1",
  position: { x: 720, y: 220 },
  size: { width: 96, height: 96 },
  interactionRadius: 90,
}

// Decoracion: arboles esparcidos en el claro del bosque
const TREES = [
  { x: 40, y: 30, size: 80 },
  { x: 140, y: 480 },
  { x: 860, y: 60, size: 70 },
  { x: 30, y: 250, size: 90 },
  { x: 850, y: 480, size: 85 },
  { x: 480, y: 20, size: 60 },
  { x: 480, y: 520, size: 60 },
  { x: 250, y: 80, size: 55 },
  { x: 600, y: 470, size: 65 },
]

export function ForestScene() {
  const playerPosition = useGameStore((s) => s.playerPosition)
  const setPlayerPosition = useGameStore((s) => s.setPlayerPosition)
  const isCraftingOpen = useGameStore((s) => s.isCraftingOpen)
  const openCrafting = useGameStore((s) => s.openCrafting)

  // Pausamos el movimiento mientras el modal esta abierto
  const movementEnabled = !isCraftingOpen
  const keysRef = useGameKeyboard(movementEnabled)

  usePlayerMovement({
    position: playerPosition,
    setPosition: setPlayerPosition,
    playerSize: PLAYER_SIZE,
    worldSize: WORLD_SIZE,
    keysRef,
    enabled: movementEnabled,
  })

  // Distancia jugador <-> caldero (matematica simple)
  const isPlayerNearCauldron = useMemo(
    () =>
      isWithinRadius(
        playerPosition,
        PLAYER_SIZE,
        CAULDRON.position,
        CAULDRON.size,
        CAULDRON.interactionRadius,
      ),
    [playerPosition],
  )

  // Tecla E para interactuar (separado del movimiento porque es un evento puntual)
  const [hasFocus, setHasFocus] = useState(true)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "e") return
      if (isCraftingOpen) return
      if (isPlayerNearCauldron) {
        e.preventDefault()
        openCrafting()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [isPlayerNearCauldron, isCraftingOpen, openCrafting])

  useEffect(() => {
    const onFocus = () => setHasFocus(true)
    const onBlur = () => setHasFocus(false)
    window.addEventListener("focus", onFocus)
    window.addEventListener("blur", onBlur)
    return () => {
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("blur", onBlur)
    }
  }, [])

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <div
        className="relative overflow-hidden rounded-2xl border-2 border-border shadow-2xl"
        style={{ width: WORLD_SIZE.width, height: WORLD_SIZE.height }}
      >
        {/* Suelo del claro: degradado verde + textura de hierba */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, #047857 0%, #065f46 55%, #022c22 100%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-30 mix-blend-overlay"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 2px, transparent 2px, transparent 8px)",
          }}
          aria-hidden
        />

        {/* Camino de tierra hacia el caldero */}
        <div
          className="absolute z-0 rounded-full bg-amber-200/15 blur-md"
          style={{ left: 380, top: 230, width: 380, height: 80 }}
          aria-hidden
        />

        {/* Decoracion: arboles */}
        {TREES.map((t, i) => (
          <GiPineTree
            key={i}
            className="absolute z-0 text-emerald-950 drop-shadow-md"
            size={t.size ?? 60}
            style={{ left: t.x, top: t.y }}
            aria-hidden
          />
        ))}

        {/* Caldero */}
        <Cauldron
          position={CAULDRON.position}
          size={CAULDRON.size}
          isPlayerNear={isPlayerNearCauldron}
        />

        {/* Jugador */}
        <Player position={playerPosition} size={PLAYER_SIZE} />

        {/* HUD superpuesto */}
        <HUD />

        {/* Aviso si la ventana no tiene foco */}
        {!hasFocus && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/60 backdrop-blur-sm">
            <p className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-card-foreground shadow-md">
              Haz clic en la ventana para jugar
            </p>
          </div>
        )}

        {/* Modal de crafteo */}
        <CraftingModal />
      </div>

      <Notifications />
    </main>
  )
}
