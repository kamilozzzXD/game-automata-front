import { useEffect, useMemo, useRef, useState } from "react"
import {
  GiDoor,
  GiSkullCrossedBones,
  GiVortex,
  GiWoodenDoor,
} from "react-icons/gi"
import { Player } from "../components/game/Player"
import { DungeonRoom } from "../components/game/DungeonRoom"
import { HUD } from "../components/ui/HUD"
import { Notifications } from "../components/ui/Notifications"
import { DUNGEON_NODE_NAMES, DUNGEON_NODE_DESCRIPTIONS } from "../core/dictionary"
import { useGameStore } from "../core/gameStore"
import { intersectsAABB } from "../core/geometry"
import { useGameKeyboard } from "../hooks/useGameKeyboard"
import { usePlayerMovement } from "../hooks/usePlayerMovement"
import { generateDungeon } from "../services/api"
import type { DungeonNode } from "../types/dungeon"
import type { Size, Vector2D } from "../types/game"

const WORLD_SIZE: Size = { width: 960, height: 600 }
const PLAYER_SIZE: Size = { width: 48, height: 48 }

// ---------------------------------------------------------------------------
// Modelo de puertas: cada habitacion tiene hasta 4 (left/right/top/bottom).
// La "left" siempre es para volver al padre. Las demas se asignan a hijos
// en el orden en que vienen en `conexiones` (right -> top -> bottom).
// ---------------------------------------------------------------------------
type DoorDir = "left" | "right" | "top" | "bottom"
const DOOR_THICK = 30
const DOOR_SPAN = 100

const DOOR_RECTS: Record<DoorDir, { pos: Vector2D; size: Size }> = {
  left: {
    pos: { x: 0, y: WORLD_SIZE.height / 2 - DOOR_SPAN / 2 },
    size: { width: DOOR_THICK, height: DOOR_SPAN },
  },
  right: {
    pos: { x: WORLD_SIZE.width - DOOR_THICK, y: WORLD_SIZE.height / 2 - DOOR_SPAN / 2 },
    size: { width: DOOR_THICK, height: DOOR_SPAN },
  },
  top: {
    pos: { x: WORLD_SIZE.width / 2 - DOOR_SPAN / 2, y: 0 },
    size: { width: DOOR_SPAN, height: DOOR_THICK },
  },
  bottom: {
    pos: { x: WORLD_SIZE.width / 2 - DOOR_SPAN / 2, y: WORLD_SIZE.height - DOOR_THICK },
    size: { width: DOOR_SPAN, height: DOOR_THICK },
  },
}

// Cuando entras a una sala por una puerta, apareces enfrente (lado opuesto)
// para que la transicion se sienta natural y no quedes pegado a la puerta.
const ENTRY_SPAWN: Record<DoorDir, Vector2D> = {
  left: { x: WORLD_SIZE.width - 110, y: WORLD_SIZE.height / 2 - PLAYER_SIZE.height / 2 },
  right: { x: 80, y: WORLD_SIZE.height / 2 - PLAYER_SIZE.height / 2 },
  top: {
    x: WORLD_SIZE.width / 2 - PLAYER_SIZE.width / 2,
    y: WORLD_SIZE.height - 110,
  },
  bottom: { x: WORLD_SIZE.width / 2 - PLAYER_SIZE.width / 2, y: 80 },
}

const OPPOSITE: Record<DoorDir, DoorDir> = {
  left: "right",
  right: "left",
  top: "bottom",
  bottom: "top",
}

const CENTER_SPAWN: Vector2D = {
  x: WORLD_SIZE.width / 2 - PLAYER_SIZE.width / 2,
  y: WORLD_SIZE.height / 2 - PLAYER_SIZE.height / 2,
}

// ---------------------------------------------------------------------------
// Escena de la mazmorra. Cada nodo del AST = una habitacion fisica.
// El jugador navega por ella con WASD y cruza puertas para cambiar de sala.
// ---------------------------------------------------------------------------
export function DungeonScene() {
  const dungeon = useGameStore((s) => s.currentDungeon)
  const setCurrentScene = useGameStore((s) => s.setCurrentScene)
  const playerPosition = useGameStore((s) => s.playerPosition)
  const setPlayerPosition = useGameStore((s) => s.setPlayerPosition)
  const isGenerating = useGameStore((s) => s.isGeneratingDungeon)
  const setIsGenerating = useGameStore((s) => s.setIsGeneratingDungeon)
  const setCurrentDungeon = useGameStore((s) => s.setCurrentDungeon)
  const pushNotification = useGameStore((s) => s.pushNotification)

  // Mapa id -> nodo para resolucion O(1).
  const nodeMap = useMemo(() => {
    const m = new Map<number, DungeonNode>()
    if (dungeon) for (const n of dungeon.estructura_ast) m.set(n.id, n)
    return m
  }, [dungeon])

  const [salaActualId, setSalaActualId] = useState<number | null>(null)

  // Cada vez que cambia la mazmorra, spawneamos en el nodo "inicio".
  useEffect(() => {
    if (!dungeon) return
    const start = dungeon.estructura_ast.find((n) => n.tipo === "inicio")
    if (!start) return
    setSalaActualId(start.id)
    setPlayerPosition(CENTER_SPAWN)
  }, [dungeon, setPlayerPosition])

  // Movimiento del jugador (mismo hook que el bosque).
  const movementEnabled = salaActualId !== null && !isGenerating
  const keysRef = useGameKeyboard(movementEnabled)
  usePlayerMovement({
    position: playerPosition,
    setPosition: setPlayerPosition,
    playerSize: PLAYER_SIZE,
    worldSize: WORLD_SIZE,
    keysRef,
    enabled: movementEnabled,
  })

  // Sala actual del store (puede ser undefined entre transiciones).
  const currentNode = salaActualId !== null ? nodeMap.get(salaActualId) : undefined

  // Padre (para la puerta izquierda "volver"). En el AST es el nodo cuya
  // `conexiones` contiene al actual.
  const parentId = useMemo(() => {
    if (salaActualId === null || !dungeon) return null
    return (
      dungeon.estructura_ast.find((n) => n.conexiones.includes(salaActualId))?.id ?? null
    )
  }, [salaActualId, dungeon])

  // Asignacion fija hijos -> direcciones (orden estable).
  const childDoors = useMemo<Partial<Record<DoorDir, number>>>(() => {
    if (!currentNode) return {}
    const map: Partial<Record<DoorDir, number>> = {}
    const c = currentNode.conexiones
    if (c[0] !== undefined) map.right = c[0]
    if (c[1] !== undefined) map.top = c[1]
    if (c[2] !== undefined) map.bottom = c[2]
    return map
  }, [currentNode])

  // Lock para no disparar la transicion multiples veces mientras el
  // rectangulo del jugador sigue intersectando la puerta.
  const transitionLockRef = useRef(false)

  useEffect(() => {
    if (!currentNode || transitionLockRef.current) return

    const tryGo = (dir: DoorDir, destId: number): boolean => {
      const door = DOOR_RECTS[dir]
      if (!intersectsAABB(playerPosition, PLAYER_SIZE, door.pos, door.size)) return false
      transitionLockRef.current = true
      setSalaActualId(destId)
      setPlayerPosition(ENTRY_SPAWN[OPPOSITE[dir]])
      // Liberamos el lock en el siguiente frame; la nueva pos ya estara lejos
      // de cualquier puerta porque ENTRY_SPAWN posiciona al jugador del lado opuesto.
      window.setTimeout(() => {
        transitionLockRef.current = false
      }, 80)
      return true
    }

    if (childDoors.right !== undefined && tryGo("right", childDoors.right)) return
    if (childDoors.top !== undefined && tryGo("top", childDoors.top)) return
    if (childDoors.bottom !== undefined && tryGo("bottom", childDoors.bottom)) return
    if (parentId !== null) tryGo("left", parentId)
  }, [playerPosition, currentNode, childDoors, parentId, setPlayerPosition])

  // Volver al bosque: spawneamos al jugador a un costado del portal
  // para que no quede sobre el (y dispare otra vez la interaccion).
  function exitDungeon() {
    setCurrentScene("forest")
    setPlayerPosition({ x: 230, y: 260 })
  }

  // Generar otra mazmorra sin abandonar la escena (regenera in-situ).
  async function regenerate() {
    if (isGenerating) return
    setIsGenerating(true)
    try {
      const res = await generateDungeon()
      setCurrentDungeon(res)
      pushNotification({ kind: "info", message: res.mensaje_ui })
    } catch (err) {
      console.error("[v0] Error regenerando mazmorra", err)
      pushNotification({
        kind: "error",
        message: "No se pudo invocar otra mazmorra.",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const isBossRoom = currentNode?.tipo === "jefe"
  const hasNoChildren = currentNode && currentNode.conexiones.length === 0

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <div
        className="relative overflow-hidden rounded-2xl border-2 border-border shadow-2xl"
        style={{ width: WORLD_SIZE.width, height: WORLD_SIZE.height }}
      >
        {/* Habitacion (fondo + decoracion segun tipo) */}
        {currentNode && <DungeonRoom type={currentNode.tipo} worldSize={WORLD_SIZE} />}

        {/* Puertas hacia hijos */}
        {Object.entries(childDoors).map(([dir, destId]) => (
          <DoorTile key={`child-${dir}`} dir={dir as DoorDir} variant="forward" destId={destId} />
        ))}

        {/* Puerta hacia el padre (volver) */}
        {parentId !== null && <DoorTile dir="left" variant="back" destId={parentId} />}

        {/* Jugador */}
        <Player position={playerPosition} size={PLAYER_SIZE} />

        {/* HUD compartido (inventario + controles) */}
        <HUD />

        {/* Etiqueta de la sala actual (top center) */}
        {currentNode && (
          <div className="pointer-events-none absolute left-1/2 top-4 z-30 flex -translate-x-1/2 flex-col items-center gap-1">
            <div className="rounded-full border border-border/60 bg-background/85 px-4 py-1 text-sm font-bold text-foreground shadow backdrop-blur">
              {DUNGEON_NODE_NAMES[currentNode.tipo]}
            </div>
            <p className="rounded bg-background/60 px-2 py-0.5 text-[10px] text-muted-foreground backdrop-blur">
              {DUNGEON_NODE_DESCRIPTIONS[currentNode.tipo]}
            </p>
          </div>
        )}

        {/* Cadena plana en pequeno como debug (esquina inferior izquierda) */}
        {dungeon && (
          <div className="pointer-events-none absolute bottom-3 left-3 z-30 max-w-[60%] rounded-md border border-border/40 bg-background/70 px-2 py-1 text-[10px] font-mono text-muted-foreground backdrop-blur">
            <span className="opacity-70">debug:</span> {dungeon.cadena_plana}
          </div>
        )}

        {/* Boton: salir de la mazmorra */}
        <button
          type="button"
          onClick={exitDungeon}
          className="absolute bottom-4 right-4 z-30 flex items-center gap-2 rounded-md border border-border/60 bg-background/85 px-3 py-2 text-xs font-semibold text-foreground shadow backdrop-blur transition-colors hover:bg-background"
        >
          <GiVortex size={16} className="text-accent" />
          Salir de la Mazmorra
        </button>

        {/* Overlay de victoria al llegar al jefe (muestra cierre del nivel) */}
        {isBossRoom && hasNoChildren && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-end justify-center pb-24">
            <div className="pointer-events-auto flex flex-col items-center gap-3 rounded-xl border border-red-500/60 bg-background/80 px-6 py-4 shadow-2xl backdrop-blur">
              <GiSkullCrossedBones className="text-red-400" size={36} />
              <p className="text-center text-sm text-foreground">
                Has alcanzado al enemigo final.
                <br />
                <span className="text-xs text-muted-foreground">
                  El combate llegara en una proxima actualizacion.
                </span>
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={regenerate}
                  disabled={isGenerating}
                  className="flex items-center gap-1 rounded bg-accent px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <GiVortex
                    size={14}
                    className={isGenerating ? "animate-spin" : undefined}
                  />
                  Generar Otra
                </button>
                <button
                  type="button"
                  onClick={exitDungeon}
                  className="rounded border border-border bg-background/60 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-background"
                >
                  Volver al Bosque
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loader cuando se esta regenerando */}
        {isGenerating && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/70 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 text-foreground/80">
              <GiVortex className="animate-spin text-accent" size={48} />
              <p className="text-sm">Tejiendo otra mazmorra...</p>
            </div>
          </div>
        )}
      </div>

      <Notifications />
    </main>
  )
}

// ---------------------------------------------------------------------------
// Visual de una puerta. No es interactiva (no hay click): el jugador "cruza"
// el rectangulo y la deteccion se hace via AABB en el efecto de la escena.
// ---------------------------------------------------------------------------
function DoorTile({
  dir,
  variant,
  destId,
}: {
  dir: DoorDir
  variant: "forward" | "back"
  destId: number
}) {
  const { pos, size } = DOOR_RECTS[dir]
  const isHorizontal = dir === "top" || dir === "bottom"
  const isBack = variant === "back"

  return (
    <div
      className="absolute z-10 flex items-center justify-center"
      style={{
        left: pos.x,
        top: pos.y,
        width: size.width,
        height: size.height,
      }}
      aria-label={`Puerta ${isBack ? "atras" : "adelante"} hacia sala ${destId}`}
    >
      {/* Halo de la puerta */}
      <div
        className={`absolute inset-0 rounded-sm ${
          isBack ? "bg-slate-400/30" : "bg-amber-300/40"
        } animate-pulse`}
        aria-hidden
      />
      {/* Marco de la puerta */}
      <div
        className={`absolute inset-0 border-2 ${
          isBack ? "border-slate-300/70" : "border-amber-300/80"
        }`}
        style={{
          borderRadius: 4,
          boxShadow: isBack
            ? "0 0 16px rgba(203, 213, 225, 0.4)"
            : "0 0 16px rgba(252, 211, 77, 0.6)",
        }}
        aria-hidden
      />
      {/* Icono */}
      {isBack ? (
        <GiDoor
          className="relative text-slate-200 drop-shadow"
          size={isHorizontal ? size.height + 4 : size.width + 4}
        />
      ) : (
        <GiWoodenDoor
          className="relative text-amber-200 drop-shadow"
          size={isHorizontal ? size.height + 4 : size.width + 4}
        />
      )}
    </div>
  )
}
