import { useEffect, useMemo, useRef, useState } from "react"
import {
  GiDoor,
  GiSkullCrossedBones,
  GiVortex,
  GiWoodenDoor,
} from "react-icons/gi"
import { Player } from "../components/game/Player"
import { Portal } from "../components/game/Portal"
import { DungeonRoom } from "../components/game/DungeonRoom"
import { HUD } from "../components/ui/HUD"
import { Notifications } from "../components/ui/Notifications"
import { DUNGEON_NODE_NAMES, DUNGEON_NODE_DESCRIPTIONS } from "../core/dictionary"
import { useGameStore } from "../core/gameStore"
import { intersectsAABB, isWithinRadius } from "../core/geometry"
import { useGameKeyboard } from "../hooks/useGameKeyboard"
import { usePlayerMovement } from "../hooks/usePlayerMovement"
import { generateDungeon } from "../services/api"
import type { DungeonNode } from "../types/dungeon"
import type { Interactable, Size, Vector2D } from "../types/game"

const WORLD_SIZE: Size = { width: 960, height: 600 }
const PLAYER_SIZE: Size = { width: 48, height: 48 }

// ---------------------------------------------------------------------------
// Modelo de puertas: cada habitacion tiene hasta 4 (left/right/top/bottom).
// Las direcciones se asignan dinamicamente respetando la coherencia espacial:
// si entras a una sala viniendo del NORTE, la puerta de regreso debe estar
// al SUR. Las puertas hacia los hijos toman las direcciones restantes.
// ---------------------------------------------------------------------------
type DoorDir = "left" | "right" | "top" | "bottom"
const DOOR_THICK = 30
const DOOR_SPAN = 100
// Orden de preferencia para asignar puertas a nodos hijos.
const ALL_DIRS: DoorDir[] = ["right", "top", "bottom", "left"]

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

// Posicion de spawn cuando el jugador acaba de entrar a una sala por una
// puerta ubicada en `dir`. Lo dejamos enfrente y lo suficientemente adentro
// para que su AABB no intersecte la puerta otra vez (evita el "rebote").
const SPAWN_NEAR_DOOR: Record<DoorDir, Vector2D> = {
  left: {
    x: 96,
    y: WORLD_SIZE.height / 2 - PLAYER_SIZE.height / 2,
  },
  right: {
    x: WORLD_SIZE.width - 96 - PLAYER_SIZE.width,
    y: WORLD_SIZE.height / 2 - PLAYER_SIZE.height / 2,
  },
  top: {
    x: WORLD_SIZE.width / 2 - PLAYER_SIZE.width / 2,
    y: 96,
  },
  bottom: {
    x: WORLD_SIZE.width / 2 - PLAYER_SIZE.width / 2,
    y: WORLD_SIZE.height - 96 - PLAYER_SIZE.height,
  },
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

// Portal de salida ubicado en la sala "inicio". Reutilizamos el mismo
// componente Portal del bosque para que la mecanica de salida sea identica
// a la mecanica de entrada (caminar + tecla E), eliminando el viejo boton
// de debug "Salir de la Mazmorra".
const EXIT_PORTAL: Interactable = {
  id: "dungeon-exit",
  position: { x: 80, y: WORLD_SIZE.height / 2 - 48 },
  size: { width: 96, height: 96 },
  interactionRadius: 90,
}

// Configuracion espacial de cada sala visitada. Se cachea por id para que las
// puertas NO salten de pared al volver a una sala ya explorada.
type RoomConfig = {
  // Direccion fisica de la puerta de regreso (al nodo padre).
  // Es null en la sala "inicio", que en su lugar contiene el portal de salida.
  backDir: DoorDir | null
  // Mapeo childId -> direccion fisica asignada.
  childDirs: Map<number, DoorDir>
}

// Asigna direcciones a los hijos respetando direcciones reservadas
// (back-door y, en la sala inicial, el lado del portal de salida).
function buildRoomConfig(
  node: DungeonNode,
  backDir: DoorDir | null,
  extraReserved: DoorDir[] = [],
): RoomConfig {
  const reserved = new Set<DoorDir>(extraReserved)
  if (backDir) reserved.add(backDir)
  const available = ALL_DIRS.filter((d) => !reserved.has(d))
  const childDirs = new Map<number, DoorDir>()
  node.conexiones.forEach((cid, i) => {
    if (i < available.length) childDirs.set(cid, available[i])
  })
  return { backDir, childDirs }
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
  // Cache persistente de la disposicion de puertas por sala.
  const [roomConfigs, setRoomConfigs] = useState<Map<number, RoomConfig>>(
    new Map(),
  )

  // Cada vez que llega una mazmorra nueva: reseteamos el cache, spawneamos
  // en el centro del nodo "inicio" y reservamos la pared izquierda para el
  // portal de salida (asi nunca colisiona con una puerta-hijo).
  useEffect(() => {
    if (!dungeon) return
    const start = dungeon.estructura_ast.find((n) => n.tipo === "inicio")
    if (!start) return
    const initial = new Map<number, RoomConfig>()
    initial.set(start.id, buildRoomConfig(start, null, ["left"]))
    setRoomConfigs(initial)
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
  const currentNode =
    salaActualId !== null ? nodeMap.get(salaActualId) : undefined
  const currentConfig =
    salaActualId !== null ? roomConfigs.get(salaActualId) : undefined

  // Padre (para la puerta de regreso). En el AST es el nodo cuya
  // `conexiones` contiene al actual.
  const parentId = useMemo(() => {
    if (salaActualId === null || !dungeon) return null
    return (
      dungeon.estructura_ast.find((n) => n.conexiones.includes(salaActualId))
        ?.id ?? null
    )
  }, [salaActualId, dungeon])

  // Lock para no disparar la transicion multiples veces mientras el
  // rectangulo del jugador sigue intersectando la puerta.
  const transitionLockRef = useRef(false)

  useEffect(() => {
    if (!currentNode || !currentConfig || transitionLockRef.current) return

    // 1) Cruzar a un hijo (puertas hacia adelante).
    for (const [childId, dir] of currentConfig.childDirs) {
      const door = DOOR_RECTS[dir]
      if (!intersectsAABB(playerPosition, PLAYER_SIZE, door.pos, door.size))
        continue
      const childNode = nodeMap.get(childId)
      if (!childNode) return
      // En la sala destino, la puerta de regreso queda en la direccion opuesta
      // a la que cruzamos (coherencia espacial: salir Norte -> entrar por Sur).
      const newBackDir = OPPOSITE[dir]
      transitionLockRef.current = true
      setRoomConfigs((prev) => {
        if (prev.has(childId)) return prev
        const next = new Map(prev)
        next.set(childId, buildRoomConfig(childNode, newBackDir))
        return next
      })
      setSalaActualId(childId)
      // Spawneamos junto a la puerta por la que llegamos (lado newBackDir),
      // pero offset hacia adentro para evitar viajes accidentales inmediatos.
      setPlayerPosition(SPAWN_NEAR_DOOR[newBackDir])
      window.setTimeout(() => {
        transitionLockRef.current = false
      }, 80)
      return
    }

    // 2) Cruzar la puerta de regreso (al padre).
    if (currentConfig.backDir !== null && parentId !== null) {
      const backDoor = DOOR_RECTS[currentConfig.backDir]
      if (
        intersectsAABB(playerPosition, PLAYER_SIZE, backDoor.pos, backDoor.size)
      ) {
        const parentConfig = roomConfigs.get(parentId)
        const dirInParent =
          salaActualId !== null
            ? parentConfig?.childDirs.get(salaActualId)
            : undefined
        transitionLockRef.current = true
        setSalaActualId(parentId)
        // En el padre, la puerta hacia esta sala estaba en `dirInParent`.
        // Spawneamos justo a su lado (offset hacia adentro) para mantener la
        // coherencia espacial: si volviste por el sur, apareces en el sur.
        setPlayerPosition(
          dirInParent ? SPAWN_NEAR_DOOR[dirInParent] : CENTER_SPAWN,
        )
        window.setTimeout(() => {
          transitionLockRef.current = false
        }, 80)
      }
    }
  }, [
    playerPosition,
    currentNode,
    currentConfig,
    parentId,
    salaActualId,
    nodeMap,
    roomConfigs,
    setPlayerPosition,
  ])

  // ---------- Salida unificada (portal en la sala inicial) ----------
  const isInInicio = currentNode?.tipo === "inicio"
  const isPlayerNearExitPortal = useMemo(() => {
    if (!isInInicio) return false
    return isWithinRadius(
      playerPosition,
      PLAYER_SIZE,
      EXIT_PORTAL.position,
      EXIT_PORTAL.size,
      EXIT_PORTAL.interactionRadius,
    )
  }, [playerPosition, isInInicio])

  // Volver al bosque: spawneamos al jugador a un costado del portal del bosque
  // para que no quede sobre el (y dispare otra vez la interaccion).
  function exitDungeon() {
    setCurrentScene("forest")
    setPlayerPosition({ x: 230, y: 260 })
  }

  // Tecla E para activar el portal de salida cuando el jugador esta cerca.
  useEffect(() => {
    if (!isInInicio) return
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "e") return
      if (!isPlayerNearExitPortal) return
      if (isGenerating) return
      e.preventDefault()
      exitDungeon()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
    // exitDungeon es estable (usa setters del store); evitamos recrear el listener.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInInicio, isPlayerNearExitPortal, isGenerating])

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
        {currentNode && (
          <DungeonRoom type={currentNode.tipo} worldSize={WORLD_SIZE} />
        )}

        {/* Portal de salida (solo en la sala inicial). Sustituye al boton
            de debug que rompia la inmersion. */}
        {isInInicio && (
          <Portal
            position={EXIT_PORTAL.position}
            size={EXIT_PORTAL.size}
            isPlayerNear={isPlayerNearExitPortal}
            label="Salir de la Mazmorra"
            actionLabel="para volver al bosque"
          />
        )}

        {/* Puertas hacia hijos (direccion segun config cacheada de la sala) */}
        {currentConfig &&
          Array.from(currentConfig.childDirs.entries()).map(([cid, dir]) => (
            <DoorTile
              key={`child-${cid}`}
              dir={dir}
              variant="forward"
              destId={cid}
            />
          ))}

        {/* Puerta hacia el padre (direccion = de donde vino el jugador) */}
        {currentConfig && currentConfig.backDir !== null && parentId !== null && (
          <DoorTile dir={currentConfig.backDir} variant="back" destId={parentId} />
        )}

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
