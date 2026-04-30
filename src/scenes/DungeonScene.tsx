import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  GiDoor,
  GiSkullCrossedBones,
  GiVortex,
  GiWoodenDoor,
} from "react-icons/gi"
import { Boss } from "../components/game/Boss"
import { Player } from "../components/game/Player"
import { Portal } from "../components/game/Portal"
import { DungeonRoom } from "../components/game/DungeonRoom"
import { HUD } from "../components/ui/HUD"
import { Notifications } from "../components/ui/Notifications"
import { DUNGEON_NODE_NAMES, DUNGEON_NODE_DESCRIPTIONS, POTION_NAMES } from "../core/dictionary"
import { useGameStore } from "../core/gameStore"
import { center, distance, intersectsAABB, isWithinRadius } from "../core/geometry"
import { useGameKeyboard } from "../hooks/useGameKeyboard"
import { useHotbarControls } from "../hooks/useHotbarControls"
import { usePlayerMovement } from "../hooks/usePlayerMovement"
import { bossAction, generateDungeon } from "../services/api"
import { parseBossState } from "../types/boss"
import type { BossState, BossStimulus } from "../types/boss"
import type { DungeonNode } from "../types/dungeon"
import type { Interactable, PotionId, Size, Vector2D } from "../types/game"

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

// ---------------------------------------------------------------------------
// Sprint 4: Configuracion del Jefe / Maquina de Moore
// ---------------------------------------------------------------------------
const BOSS_SIZE: Size = { width: 80, height: 80 }

// Sprint Polish-Pass - Tarea 4: el jefe spawnea en el lado opuesto de la
// sala respecto a la puerta por la que el jugador entro. Asi evitamos
// que el simple acto de cruzar la puerta dispare el estimulo de vision (v).
//
// Si el jugador entra por la izquierda  -> jefe a la derecha.
// Si entra por arriba                   -> jefe abajo. (Y viceversa.)
//
// `backDir` representa la pared donde quedo la puerta de regreso, que es
// justamente la puerta por la que entro el jugador. El jefe se planta
// junto a la pared opuesta (OPPOSITE[backDir]) con un margen razonable.
const BOSS_WALL_MARGIN = 80
function getBossPosition(backDir: DoorDir | null): Vector2D {
  // Si por algun motivo no conocemos la entrada, fallback al centro.
  if (!backDir) {
    return {
      x: WORLD_SIZE.width / 2 - BOSS_SIZE.width / 2,
      y: WORLD_SIZE.height / 2 - BOSS_SIZE.height / 2,
    }
  }
  const opposite = OPPOSITE[backDir]
  switch (opposite) {
    case "left":
      return {
        x: BOSS_WALL_MARGIN,
        y: WORLD_SIZE.height / 2 - BOSS_SIZE.height / 2,
      }
    case "right":
      return {
        x: WORLD_SIZE.width - BOSS_SIZE.width - BOSS_WALL_MARGIN,
        y: WORLD_SIZE.height / 2 - BOSS_SIZE.height / 2,
      }
    case "top":
      return {
        x: WORLD_SIZE.width / 2 - BOSS_SIZE.width / 2,
        y: BOSS_WALL_MARGIN,
      }
    case "bottom":
      return {
        x: WORLD_SIZE.width / 2 - BOSS_SIZE.width / 2,
        y: WORLD_SIZE.height - BOSS_SIZE.height - BOSS_WALL_MARGIN,
      }
  }
}
// Umbrales de deteccion (px). Calculo: distancia euclidiana entre centros
// del jugador y del jefe.
const VISION_RADIUS = 130 // dentro de este radio -> estimulo "v" (vision)
const NOISE_RADIUS = 260 // dentro de este radio (y fuera del de vision) -> "r"
// Periodo del polling de la IA. No tiene sentido spamear /api/boss-action
// en cada frame; ~600ms da feedback rapido sin saturar el backend.
const BOSS_TICK_MS = 600
// Duracion del efecto de invisibilidad (ms). Se consume 1 unidad de P4.
const INVISIBILITY_MS = 6000

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

  // Sprint 4 - Estado del jefe (Maquina de Moore) e invisibilidad
  const bossState = useGameStore((s) => s.bossState)
  const setBossState = useGameStore((s) => s.setBossState)
  const setBossActionStore = useGameStore((s) => s.setBossAction)
  const isBossThinking = useGameStore((s) => s.isBossThinking)
  const setIsBossThinking = useGameStore((s) => s.setIsBossThinking)
  const resetBoss = useGameStore((s) => s.resetBoss)
  const setPlayerInvisible = useGameStore((s) => s.setPlayerInvisible)

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
  // para que no quede sobre el (y dispare otra vez la interaccion). Tambien
  // apagamos el efecto de invisibilidad para que no se "lleve" al bosque.
  function exitDungeon() {
    setCurrentScene("forest")
    setPlayerPosition({ x: 230, y: 260 })
    setPlayerInvisible(false)
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
  // Sala del jefe = nodo "jefe" sin hijos (el ultimo de la rama).
  const bossPresent = !!isBossRoom && !!hasNoChildren

  // Sprint Polish-Pass - Tarea 4: posicion del jefe segun la pared
  // por la que entro el jugador. Se recalcula cuando cambia la sala
  // o la direccion de la puerta de regreso.
  const bossPosition = useMemo(
    () => getBossPosition(currentConfig?.backDir ?? null),
    [currentConfig?.backDir],
  )

  // -------------------------------------------------------------------------
  // Sprint 4 - Llamada a /api/boss-action y aplicacion de la transicion.
  // Centralizada en un callback para reusarla desde el polling y desde
  // el handler de "usar Pocion de Invisibilidad".
  // -------------------------------------------------------------------------
  const sendBossStimulus = useCallback(
    async (stimulus: BossStimulus, currentState: BossState) => {
      if (useGameStore.getState().isBossThinking) return
      setIsBossThinking(true)
      try {
        const res = await bossAction({
          estado_actual: currentState,
          estimulo: stimulus,
        })
        const parsed = parseBossState(res.nuevo_estado)
        if (parsed) setBossState(parsed)
        // La accion viene como string del backend; el store la guarda
        // como BossAction (cualquier valor inesperado se tolera como string).
        setBossActionStore(res.accion as never)
        // Solo notificamos cambios "interesantes" (cuando el estado cambio)
        // para no spamear el bottom-left con repeticiones.
        if (parsed && parsed !== currentState) {
          pushNotification({
            kind: parsed === "C" ? "error" : parsed === "B" ? "info" : "success",
            message: res.mensaje_ui,
          })
        }
      } catch (err) {
        console.error("[v0] Error consultando IA del jefe", err)
      } finally {
        setIsBossThinking(false)
      }
    },
    [pushNotification, setBossActionStore, setBossState, setIsBossThinking],
  )

  // -------------------------------------------------------------------------
  // Sprint 4 - Reset del jefe al entrar/salir de la sala del jefe
  // (estado inicial = "A" / Patrullar). Ademas cancelamos cualquier
  // efecto de invisibilidad activo cuando salimos de mazmorra.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (bossPresent) {
      resetBoss()
    }
  }, [bossPresent, resetBoss])

  // -------------------------------------------------------------------------
  // Sprint 4 - Polling de la IA (Maquina de Moore).
  // Cada tick (~600ms) calculamos la distancia jugador<->jefe y deducimos
  // que estimulo tocaria enviar:
  //   dist <= VISION_RADIUS  -> "v"
  //   dist <= NOISE_RADIUS   -> "r"
  //   sino                   -> sin estimulo (no llamamos al backend)
  //
  // OPTIMIZACION: si el estado actual + el estimulo dan la misma
  // transicion (no cambia de estado), evitamos la llamada para no
  // saturar el backend cuando el jugador "se queda quieto" en la zona.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!bossPresent) return
    let mounted = true
    const tick = () => {
      if (!mounted) return
      // Si el jugador esta invisible no hay deteccion sensorial.
      // El "p" se dispara explicitamente al beber la pocion (no aqui).
      const snap = useGameStore.getState()
      if (snap.isPlayerInvisible) return

      // Tomamos la posicion fresca del jugador en cada tick para
      // que el ritmo del polling no dependa del re-render de React.
      const dist = distance(
        center(snap.playerPosition, PLAYER_SIZE),
        center(bossPosition, BOSS_SIZE),
      )

      let stim: BossStimulus | null = null
      if (dist <= VISION_RADIUS) stim = "v"
      else if (dist <= NOISE_RADIUS) stim = "r"
      if (!stim) return

      // Filtrado: Moore es determinista, hay transiciones que son
      // identidad (e.g. "C" + "v" = "C", "C" + "r" = "C", "B" + "r" = "B").
      // Evitamos llamadas redundantes.
      const cur = snap.bossState
      if (stim === "v" && cur === "C") return
      if (stim === "r" && (cur === "B" || cur === "C")) return

      void sendBossStimulus(stim, cur)
    }

    const interval = window.setInterval(tick, BOSS_TICK_MS)
    // Tick inmediato al entrar a la sala para no esperar 600ms.
    tick()
    return () => {
      mounted = false
      window.clearInterval(interval)
    }
    // playerPosition NO va aqui: lo leemos via getState() en cada tick
    // para evitar re-crear el interval en cada frame. bossPosition si
    // entra como dep porque cambia con la entrada del jugador a la sala.
  }, [bossPresent, sendBossStimulus, bossPosition])

  // -------------------------------------------------------------------------
  // Sprint 4 - Handler de "usar pocion seleccionada" (tecla Q).
  // Solo P4 (Pocion de Invisibilidad) tiene efecto activo en este sprint.
  // Tras activar el efecto, si el jefe esta en B o C disparamos el
  // estimulo "p" para que el backend lo regrese a un estado calmo.
  // -------------------------------------------------------------------------
  const onUsePotion = useCallback(
    (id: PotionId) => {
      if (id !== "P4") {
        // Pocion sin efecto programado todavia. Igual la consumimos
        // (lo hizo el store) y notificamos al jugador para feedback.
        pushNotification({
          kind: "info",
          message: `Has usado: ${POTION_NAMES[id]} (sin efecto activo aun).`,
        })
        return
      }

      // Activar invisibilidad por INVISIBILITY_MS. Si ya estaba activa,
      // refrescamos la duracion (el jugador tiende a "stackear" pociones).
      setPlayerInvisible(true)
      window.setTimeout(() => setPlayerInvisible(false), INVISIBILITY_MS)
      pushNotification({
        kind: "success",
        message: "Bebes la Pocion de Invisibilidad. Te vuelves translucido.",
      })

      // Si estamos en la sala del jefe y el jefe ya nos detecto,
      // mandamos "p" inmediatamente: en Moore, p => C->B, B->A, A->A.
      const cur = useGameStore.getState().bossState
      if (bossPresent && (cur === "B" || cur === "C")) {
        void sendBossStimulus("p", cur)
      }
    },
    [bossPresent, pushNotification, sendBossStimulus, setPlayerInvisible],
  )

  // Hotbar (Sprint 4): activo siempre que el jugador pueda jugar.
  useHotbarControls({
    enabled: movementEnabled,
    onUsePotion,
  })

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

        {/* Jefe (solo en la sala con tipo "jefe" sin hijos) */}
        {bossPresent && (
          <Boss position={bossPosition} size={BOSS_SIZE} state={bossState} />
        )}

        {/* Jugador */}
        <Player position={playerPosition} size={PLAYER_SIZE} />

        {/* HUD compartido (inventario + controles + hotbar
            integrada en la columna izquierda - Sprint Polish-Pass T1). */}
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

        {/* Panel discreto en la sala del jefe (Sprint 4):
            - Muestra el estado/accion actual del automata.
            - Botones de regenerar y salir, sin tapar al jefe (lateral inf.) */}
        {bossPresent && (
          <div className="pointer-events-none absolute bottom-12 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-2">
            <div className="rounded-md border border-red-500/40 bg-background/85 px-3 py-1.5 text-center shadow backdrop-blur">
              <p className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-red-300">
                <GiSkullCrossedBones size={14} />
                IA del Jefe: estado {bossState}
                {isBossThinking && (
                  <GiVortex size={12} className="animate-spin text-amber-300" />
                )}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {bossState === "A"
                  ? "Patrulla relajada"
                  : bossState === "B"
                    ? "En busqueda - alerta"
                    : "Atacando - ¡huye o usa Invisibilidad!"}
              </p>
            </div>
            <div className="pointer-events-auto flex gap-2">
              <button
                type="button"
                onClick={regenerate}
                disabled={isGenerating}
                className="flex items-center gap-1 rounded bg-accent px-2 py-1 text-[10px] font-semibold text-background hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <GiVortex
                  size={12}
                  className={isGenerating ? "animate-spin" : undefined}
                />
                Otra Mazmorra
              </button>
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
