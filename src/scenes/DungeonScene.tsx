import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  GiDoor,
  GiSkullCrossedBones,
  GiVortex,
  GiWoodenDoor,
  GiOpenTreasureChest,
  GiKey,
} from "react-icons/gi"
import { Boss } from "../components/game/Boss"
import { MiniBoss } from "../components/game/MiniBoss"
import { loadImage } from "../utils/assetLoader"
import spritesheetUrl from "../assets/character-spritesheet.png"
import { Portal } from "../components/game/Portal"
import { Projectile } from "../components/game/Projectile"
import { DungeonRoom } from "../components/game/DungeonRoom"
import { IngredientItem } from "../components/game/IngredientItem"
import { BossHealthBar } from "../components/ui/BossHealthBar"
import { MiniBossHealthBar } from "../components/ui/MiniBossHealthBar"
import { PlayerHealthBar } from "../components/ui/PlayerHealthBar"
import { HUD } from "../components/ui/HUD"
import { Notifications } from "../components/ui/Notifications"
import { DUNGEON_NODE_NAMES, DUNGEON_NODE_DESCRIPTIONS, POTION_NAMES, INGREDIENT_NAMES } from "../core/dictionary"
import { POTION_DURATIONS, POTION_EFFECT_VALUES, COMBAT_CONFIG } from "../core/diccionario"
import { useGameStore } from "../core/gameStore"
import { center, distance, intersectsAABB, isWithinRadius } from "../core/geometry"
import { useGameKeyboard } from "../hooks/useGameKeyboard"
import { useHotbarControls } from "../hooks/useHotbarControls"
import { usePlayerMovement } from "../hooks/usePlayerMovement"
import { useCanvasLoop } from "../hooks/useCanvasLoop"
import { bossAction, combatHit } from "../services/api"
import { parseBossState } from "../types/boss"
import type { BossAction, BossState, BossStimulus } from "../types/boss"
import type { DungeonNode } from "../types/dungeon"
import type { Ingredient, Interactable, PotionId, Size, Vector2D } from "../types/game"
import musicaUrl from "../assets/musica.mp3"

const WORLD_SIZE: Size = { width: 960, height: 600 }
const PLAYER_SIZE: Size = { width: 48, height: 48 }
const GRID_SIZE = 40
const SPRITE_SIZE = 64 // LPC frame: 64×64 px

function pseudoRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function getMiniBossType(nodeId: number): "skeleton" | "ghost" | "witch" {
  const rand = pseudoRandom(nodeId * 1.3)
  if (rand < 0.33) return "skeleton"
  if (rand < 0.66) return "ghost"
  return "witch"
}

type Hazard = {
  id: string
  type: "lava" | "picos"
  position: Vector2D
  size: Size
}

function generateHazards(node: DungeonNode): Hazard[] {
  if (node.tipo !== "pasillo" && node.tipo !== "sala") return []
  const list: Hazard[] = []
  const count = 3 // 3 peligros por habitación
  let attempts = 0

  while (list.length < count && attempts < 50) {
    const index = list.length
    const seedX = node.id * 80 + index * 25 + attempts * 9
    const seedY = node.id * 80 + index * 25 + attempts * 9 + 10
    const seedType = node.id * 80 + index * 25 + attempts * 9 + 30
    attempts++

    // Márgenes seguros: x en 250..WORLD_SIZE.width-250, y en 180..WORLD_SIZE.height-180
    const x = 250 + pseudoRandom(seedX) * (WORLD_SIZE.width - 500)
    const y = 180 + pseudoRandom(seedY) * (WORLD_SIZE.height - 360)

    // Evitar colisión/superposición (distancia mínima de 90px entre centros)
    let tooClose = false
    for (const h of list) {
      const dx = x - h.position.x
      const dy = y - h.position.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 90) {
        tooClose = true
        break
      }
    }

    if (tooClose) continue

    const type = pseudoRandom(seedType) > 0.5 ? "lava" : "picos"
    list.push({
      id: `hazard-${node.id}-${index}`,
      type,
      position: { x, y },
      size: { width: 64, height: 64 },
    })
  }
  return list
}


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
const VISION_RADIUS = COMBAT_CONFIG.VISION_RADIUS // dentro de este radio -> estimulo "v" (vision)
const NOISE_RADIUS = COMBAT_CONFIG.NOISE_RADIUS // dentro de este radio (y fuera del de vision) -> "r"
// Periodo del polling de la IA. No tiene sentido spamear /api/boss-action
// en cada frame; ~600ms da feedback rapido sin saturar el backend.
const BOSS_TICK_MS = COMBAT_CONFIG.BOSS_TICK_MS
// Duracion del efecto de invisibilidad (ms). Se consume 1 unidad de P4.
const INVISIBILITY_MS = POTION_DURATIONS.INVISIBILITY
// Tarea 3.3: curación de las pociones P1 y P5.
const POTION_P1_HEAL = POTION_EFFECT_VALUES.P1_HEAL  // Poción Menor de Curación
const POTION_P5_HEAL = POTION_EFFECT_VALUES.P5_HEAL  // Poción de Curación Mayor
// Duraciones de los efectos de cada poción activa (ms).
const POTION_AIM_MS = POTION_DURATIONS.AIM       // P2: Aceite de Puntería
const POTION_SPEED_MS = POTION_DURATIONS.SPEED     // P6: Velocidad de Movimiento
const POTION_MULTISHOT_MS = POTION_DURATIONS.MULTISHOT // P7: Suero de Disparo Múltiple
const POTION_REFLEX_MS = POTION_DURATIONS.REFLEX    // P8: Tónico de Hiper-Reflejos
const POTION_SHIELD_MS = POTION_DURATIONS.SHIELD    // P9: Escudo de Energía
const POTION_CADENCE_MS = POTION_DURATIONS.CADENCE   // P10: Brebaje de Cadencia Extrema
// Factor de aumento de daño con Aceite de Puntería.
const AIM_POTION_DAMAGE_MULT = POTION_EFFECT_VALUES.AIM_DAMAGE_MULT
// Multiplicador de velocidad de movimiento con P6.
export const SPEED_POTION_MULT = POTION_EFFECT_VALUES.SPEED_MULT

// ---------------------------------------------------------------------------
// Tarea 3.1 - Configuracion del sistema de combate del jugador.
// ---------------------------------------------------------------------------
// Tamano del ingrediente a recoger.
const INGREDIENT_SIZE: Size = { width: 40, height: 40 }
// Tamano del proyectil (cuadrado para AABB; visualmente es circular).
const PROJECTILE_SIZE: Size = { width: 14, height: 14 }
// Velocidad: pixeles avanzados por frame de rAF (a 60fps -> ~360 px/s).
const PROJECTILE_SPEED = 6
// Distancia maxima en pixeles antes de "missing" (auto-destruccion).
// Si no destruimos los proyectiles, el array crece indefinidamente y
// la pestana acaba colapsando.
const PROJECTILE_MAX_DISTANCE = 400
// Cooldown entre disparos para evitar que mantener J pulsada genere
// 60 proyectiles por segundo.
const SHOOT_COOLDOWN_MS = COMBAT_CONFIG.SHOOT_COOLDOWN_MS
// Tarea 3.3: daño que inflige el proyectil del jugador al jefe.
const PLAYER_PROJECTILE_DAMAGE = COMBAT_CONFIG.PLAYER_PROJECTILE_DAMAGE
// Fase 4 (3.2): distancia máxima para detectar "near miss" (proyectil que
// pasa cerca del jefe sin impactar). Esto dispara el estímulo "h".
const BOSS_NEAR_MISS_THRESHOLD = 40

type ProjectileState = {
  id: number
  // Posicion del CENTRO del proyectil (no la esquina). Es lo que pinta
  // el componente <Projectile /> y lo que usamos para AABB-vs-jefe.
  x: number
  y: number
  // Vector unitario de movimiento, capturado en el momento del disparo.
  dx: number
  dy: number
  // Acumulado para sacar el proyectil cuando se pasa de PROJECTILE_MAX_DISTANCE.
  distanciaRecorrida: number
  // Fase 4 (3.2): flag para evitar enviar el estímulo "h" múltiples veces
  // cuando el proyectil pasa cerca del jefe (near miss).
  triggeredNearMiss?: boolean
}

// ===========================================================================
// Tarea 3.2 - Combate del Jefe (Moore AI Action) y Modo Furia
// ===========================================================================
//
// La IA del jefe (Maquina de Moore) ya determina QUE debe hacer:
//   A = Patrullar  -> deambular lento por la sala
//   B = Buscar     -> quedarse quieto, "girando" la mirada
//   C = Atacar     -> perseguir al jugador y disparar
//
// Aqui implementamos el COMO. Mantenemos los proyectiles del jefe en un
// array SEPARADO del jugador (`bossProyectiles`) para que sus colisiones
// solo evaluen contra el rect del jugador y no se hagan dano a si mismos.
// ---------------------------------------------------------------------------

// Velocidades del jefe (px/frame de rAF, ~60fps).
const BOSS_PATROL_SPEED = 1.5   // Estado A: paseo lento.
const BOSS_ATTACK_SPEED = 3.0   // Estado C: persecucion.
// Distancia minima que el jefe respeta del jugador en estado C, asi su
// sprite no se monta encima del del jugador (no es parte del spec, pero
// evita que el AABB del jefe se "trabe" sobre el del jugador).
const BOSS_MIN_DISTANCE_TO_PLAYER = 60
// Margen contra los muros: dejamos un padding para que el jefe no quede
// pegado al borde y, por ende, los proyectiles que dispara nazcan dentro
// del mundo (no off-screen).
const BOSS_WORLD_MARGIN = 24

// Patrullaje (estado A): el jefe elige un punto aleatorio dentro de un
// radio limitado y camina hacia el. Cuando llega, elige otro.
const BOSS_PATROL_RADIUS = 150
// Si el jefe esta a < esta distancia del objetivo, lo damos por alcanzado
// y elegimos un nuevo punto. Tiene que ser >= BOSS_PATROL_SPEED, sino
// nunca "llegaria" exactamente.
const BOSS_PATROL_REACHED_EPSILON = 4

// Cooldown entre disparos basicos del jefe (estado C).
const BOSS_SHOOT_COOLDOWN_MS = 1500
// Cooldown entre disparos de los mini-jefes en salas secretas.
const MINI_BOSS_SHOOT_COOLDOWN_MS = 1000
// Tarea 3.3: daño que infligen los proyectiles del jefe al jugador.
const BOSS_BASIC_PROJECTILE_DAMAGE = 23
const BOSS_HEAVY_PROJECTILE_DAMAGE = 38

// Configuracion de los proyectiles del jefe.
// "Basico": un poco mas grande que el del jugador, mas lento, color rojo.
const BOSS_BASIC_PROJECTILE_SIZE: Size = { width: 18, height: 18 }
const BOSS_BASIC_PROJECTILE_SPEED = 4
const BOSS_BASIC_PROJECTILE_MAX_DISTANCE = 600

// "Pesado" (Modo Furia): el doble de tamano, 20% mas lento que el basico,
// y al expirar (timeout/distancia) se fragmenta en 8 proyectiles basicos
// hacia las 8 direcciones cardinales/diagonales.
const BOSS_HEAVY_PROJECTILE_SIZE: Size = {
  width: BOSS_BASIC_PROJECTILE_SIZE.width * 2,
  height: BOSS_BASIC_PROJECTILE_SIZE.height * 2,
}
const BOSS_HEAVY_PROJECTILE_SPEED = BOSS_BASIC_PROJECTILE_SPEED * 0.8
// Distancia tras la cual el pesado "explota" y se fragmenta. Lo bajamos
// respecto al basico porque el tamano grande ya es amenaza suficiente.
const BOSS_HEAVY_PROJECTILE_MAX_DISTANCE = 320

// Las 8 direcciones de la fragmentacion del proyectil pesado. 0.707 es
// la normalizacion 1/sqrt(2) para mantener |v| = 1 en las diagonales y
// que la velocidad sea constante en todas las direcciones.
const ESQUIRLAS_8_DIR: ReadonlyArray<{ dx: number; dy: number }> = [
  { dx: 0, dy: -1 },          // N
  { dx: 0, dy: 1 },           // S
  { dx: 1, dy: 0 },           // E
  { dx: -1, dy: 0 },          // O
  { dx: 0.707, dy: -0.707 },  // NE
  { dx: -0.707, dy: -0.707 }, // NO
  { dx: 0.707, dy: 0.707 },   // SE
  { dx: -0.707, dy: 0.707 },  // SO
]

type BossProjectileKind = "basic" | "heavy" | "poison"

type BossProjectileState = {
  id: number
  // Posicion del CENTRO (misma convencion que ProjectileState del jugador).
  x: number
  y: number
  dx: number
  dy: number
  distanciaRecorrida: number
  kind: BossProjectileKind
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
  const pushNotification = useGameStore((s) => s.pushNotification)
  const collectDungeonIngredients = useGameStore((s) => s.collectDungeonIngredients)
  const claimSecretRoomPotions = useGameStore((s) => s.claimSecretRoomPotions)
  const playerHp = useGameStore((s) => s.playerHp)
  const isVictoryAchieved = useGameStore((s) => s.isVictoryAchieved)

  // Sprint 4 - Estado del jefe (Maquina de Moore) e invisibilidad
  const bossState = useGameStore((s) => s.bossState)
  const bossLives = useGameStore((s) => s.bossLives)
  const setBossState = useGameStore((s) => s.setBossState)
  const setBossActionStore = useGameStore((s) => s.setBossAction)
  const isBossThinking = useGameStore((s) => s.isBossThinking)
  const setIsBossThinking = useGameStore((s) => s.setIsBossThinking)
  const resetBoss = useGameStore((s) => s.resetBoss)
  const setPlayerInvisible = useGameStore((s) => s.setPlayerInvisible)

  // Mini-Boss state
  const miniBossState = useGameStore((s) => s.miniBossState)
  const miniBossHp = useGameStore((s) => s.miniBossHp)
  const setMiniBossState = useGameStore((s) => s.setMiniBossState)
  const setMiniBossActionStore = useGameStore((s) => s.setMiniBossAction)
  const resetMiniBoss = useGameStore((s) => s.resetMiniBoss)

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

  // Estados de la Llave de Oro de la Victoria
  const [keySpawned, setKeySpawned] = useState(false)
  const [keyCollected, setKeyCollected] = useState(false)
  const [keyPosition, setKeyPosition] = useState<Vector2D>({ x: 0, y: 0 })

  // Control de teletransporte para el Fantasma
  const lastGhostTeleportRef = useRef<number>(0)

  // Reproducción de música de fondo de la mazmorra en bucle.
  // Se apaga automáticamente en caso de muerte (playerHp === 0) o al salir de la escena.
  useEffect(() => {
    const audio = new Audio(musicaUrl)
    audio.loop = true
    audio.volume = 0.3 // Volumen agradable

    if (playerHp > 0) {
      audio.play().catch((err) => {
        console.warn("La reproducción de música fue bloqueada o falló:", err)
      })
    } else {
      audio.pause()
    }

    return () => {
      audio.pause()
    }
  }, [playerHp === 0])

  // Cada vez que llega una mazmorra nueva: reseteamos el cache, spawneamos
  // en el centro del nodo "inicio" y reservamos la pared izquierda para el
  // portal de salida (asi nunca colisiona con una puerta-hijo).
  useEffect(() => {
    if (!dungeon) return
    // Si la salaActualId ya está seteada, significa que estamos navegando
    // por la mazmorra y solo se ha actualizado el estado (ej. al recoger ingredientes).
    // No queremos reiniciar la posición.
    if (salaActualId !== null) return

    const start = dungeon.estructura_ast.find((n) => n.tipo === "inicio")
    if (!start) return
    const initial = new Map<number, RoomConfig>()
    initial.set(start.id, buildRoomConfig(start, null, ["left"]))
    setRoomConfigs(initial)
    setSalaActualId(start.id)
    setPlayerPosition(CENTER_SPAWN)
  }, [dungeon, salaActualId, setPlayerPosition])

  // Movimiento del jugador (mismo hook que el bosque).
  const movementEnabled = salaActualId !== null && !isGenerating && playerHp > 0 && !isVictoryAchieved
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
  // Ref para leer currentNode desde callbacks estáticos (drawDungeon, rAF)
  const currentNodeRef = useRef(currentNode)
  currentNodeRef.current = currentNode
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
        if (currentNode?.tipo === "jefe" && bossLives > 0) {
          const now = performance.now()
          if (now - lastExitWarnRef.current > 3000) {
            lastExitWarnRef.current = now
            pushNotification({
              kind: "error",
              message: "¡La puerta de la guarida está sellada por magia oscura! Debes derrotar al Jefe.",
            })
          }
          return
        }
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

    // 3) Recolección de Ingredientes (si la sala tiene).
    if (currentNode.ingredientes && currentNode.ingredientes.length > 0) {
      const remaining: (Ingredient | null)[] = [...currentNode.ingredientes]
      const collected: Ingredient[] = []

      currentNode.ingredientes.forEach((ing, idx) => {
        if (!ing) return

        const seedX = currentNode.id * 100 + idx
        const seedY = currentNode.id * 100 + idx + 50
        const x = 150 + pseudoRandom(seedX) * (WORLD_SIZE.width - 300)
        const y = 150 + pseudoRandom(seedY) * (WORLD_SIZE.height - 300)

        const ingPos = { x, y }
        if (intersectsAABB(playerPosition, PLAYER_SIZE, ingPos, INGREDIENT_SIZE)) {
          collected.push(ing)
          remaining[idx] = null
        }
      })

      if (collected.length > 0) {
        collectDungeonIngredients(currentNode.id, collected, remaining)

        // Contar frecuencias para el mensaje
        const counts = collected.reduce((acc, i) => {
          acc[i] = (acc[i] || 0) + 1
          return acc
        }, {} as Partial<Record<Ingredient, number>>)

        const summary = Object.entries(counts)
          .map(([k, v]) => `${INGREDIENT_NAMES[k as Ingredient]} x${v}`)
          .join(", ")

        pushNotification({
          kind: "info",
          message: `Has recogido materiales: ${summary}`,
        })
      }
    }

    // 4) Recolección de Cofre de Sala Secreta (si es sala y no ha sido reclamado)
    if (currentNode.tipo === "sala" && !currentNode.pociones_reclamadas) {
      const chestSize = { width: 100, height: 100 }
      // Centramos el bounding box dentro del ícono de 140px para que la colisión sea más precisa
      const chestPos = {
        x: WORLD_SIZE.width - 180 + 20,
        y: 60 + 20,
      }

      if (intersectsAABB(playerPosition, PLAYER_SIZE, chestPos, chestSize)) {
        // Aseguramos exactamente 5 Mezclas Volátiles (P3) en el botín
        const generatedPotions: PotionId[] = ["P3", "P3", "P3", "P3", "P3"]
        // Adicionalmente, añadimos entre 1 y 2 pociones aleatorias extra
        const allPotions: PotionId[] = ["P1", "P2", "P4", "P5", "P6", "P7", "P8", "P9", "P10"]
        const amount = Math.floor(Math.random() * 2) + 1
        for (let i = 0; i < amount; i++) {
          generatedPotions.push(allPotions[Math.floor(Math.random() * allPotions.length)])
        }

        claimSecretRoomPotions(currentNode.id, generatedPotions)

        const counts = generatedPotions.reduce((acc, p) => {
          acc[p] = (acc[p] || 0) + 1
          return acc
        }, {} as Partial<Record<PotionId, number>>)

        const summary = Object.entries(counts)
          .map(([k, v]) => `${POTION_NAMES[k as PotionId]} x${v}`)
          .join(", ")

        pushNotification({
          kind: "success",
          message: `Has encontrado un tesoro mágico: ${summary}`,
        })
      }
    }

    // 4.5) Colisión con la Llave de Oro (si está spawnada y no recogida)
    if (keySpawned && !keyCollected) {
      const keySize = { width: 48, height: 48 }
      const keyAABBPos = {
        x: keyPosition.x + BOSS_SIZE.width / 2 - keySize.width / 2,
        y: keyPosition.y + BOSS_SIZE.height / 2 - keySize.height / 2,
      }
      if (intersectsAABB(playerPosition, PLAYER_SIZE, keyAABBPos, keySize)) {
        setKeyCollected(true)
        pushNotification({
          kind: "success",
          message: "¡Enhorabuena! Has liberado a los habitantes del pueblo.",
        })
        useGameStore.getState().setVictoryAchieved(true)
      }
    }

    // 5) Colisión con peligros de suelo (lava/picos - Tarea Combate)
    if (currentNode && (currentNode.tipo === "pasillo" || currentNode.tipo === "sala")) {
      const hazards = generateHazards(currentNode)
      const collidingHazard = hazards.find((h) =>
        intersectsAABB(playerPosition, PLAYER_SIZE, h.position, h.size)
      )
      if (collidingHazard) {
        const now = performance.now()
        if (now - lastHazardDamageTimeRef.current > 800) {
          lastHazardDamageTimeRef.current = now
          const isShielded = useGameStore.getState().isShieldActive
          if (!isShielded) {
            const damage = 10
            const currentPlayerHp = useGameStore.getState().playerHp
            if (currentPlayerHp > 0) {
              void combatHit({
                hp_actual: currentPlayerHp,
                dano_recibido: damage,
              }).then((res) => {
                useGameStore.getState().setPlayerHp(res.hp_resultante)
                useGameStore.getState().setPlayerHealthFlash(true)
                const msg = collidingHazard.type === "lava"
                  ? "¡Te quemas en la lava! -10 HP (Sustracción propia de Turing)"
                  : "¡Pisas un foso de picos! -10 HP (Sustracción propia de Turing)"
                pushNotification({
                  kind: "error",
                  message: msg,
                })
                if (res.hp_resultante === 0) {
                  useGameStore.getState().resetBoss()
                  setBossProyectiles([])
                }
              }).catch((err) => {
                console.error("[v0] Error en combatHit (hazard):", err)
              })
            }
          }
        }
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
    collectDungeonIngredients,
    claimSecretRoomPotions,
    pushNotification,
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
  // apagamos el efecto de invisibilidad y reseteamos la vida del jugador.
  const setPlayerHp = useGameStore((s) => s.setPlayerHp)

  function exitDungeon() {
    setCurrentScene("forest")
    setPlayerPosition({ x: 230, y: 260 })
    setPlayerInvisible(false)
    // Tarea 3.3: Al salir de la mazmorra, el jugador recupera toda su vida.
    setPlayerHp(100)
    setKeySpawned(false)
    setKeyCollected(false)
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



  const isBossRoom = currentNode?.tipo === "jefe"
  const hasNoChildren = currentNode && currentNode.conexiones.length === 0
  // Sala del jefe = nodo "jefe" sin hijos (el ultimo de la rama).
  const bossPresent = !!isBossRoom && !!hasNoChildren

  // Sprint Polish-Pass - Tarea 4: posicion INICIAL del jefe segun la
  // pared por la que entro el jugador. Se calcula al entrar a la sala.
  // Tarea 3.2: ahora la posicion del jefe es DINAMICA (se mueve segun
  // su Maquina de Moore), por lo que la guardamos como `useState` y la
  // espejeamos en un ref para que el polling de la IA y el game loop
  // de los proyectiles puedan leerla a 60fps sin recrear effects.
  const initialBossPosition = useMemo(
    () => getBossPosition(currentConfig?.backDir ?? null),
    [currentConfig?.backDir],
  )
  const [bossPosition, setBossPosition] = useState<Vector2D>(initialBossPosition)
  const bossPositionRef = useRef<Vector2D>(initialBossPosition)
  bossPositionRef.current = bossPosition

  // Pon estos junto a tus otros useRef
  const bossCurrentSpeedRef = useRef(2.0)
  const isMachineGunRef = useRef(false)
  const nextMachineGunTimeRef = useRef(0)
  const machineGunEndTimeRef = useRef(0)
  const isSecretRoom = currentNode?.tipo === "sala"
  const secretBossPresent = !!isSecretRoom && !(currentNode?.enemigo_derrotado)

  // Comparten la misma posición inicial
  const [miniBossPosition, setMiniBossPosition] = useState<Vector2D>(initialBossPosition)
  const miniBossPositionRef = useRef<Vector2D>(initialBossPosition)
  miniBossPositionRef.current = miniBossPosition

  // Cuando cambia la sala (o la pared de entrada), reseteamos la posicion
  // del jefe a su spawn. NO escribimos cada frame: solo en transiciones.
  useEffect(() => {
    setBossPosition(initialBossPosition)
    bossPositionRef.current = initialBossPosition

    setMiniBossPosition(initialBossPosition)
    miniBossPositionRef.current = initialBossPosition
    resetMiniBoss()
  }, [initialBossPosition, resetMiniBoss])

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
    [setBossState, setBossActionStore, setIsBossThinking],
  )

  const sendMiniBossStimulus = useCallback(
    async (stimulus: BossStimulus, currentState: BossState) => {
      if (useGameStore.getState().isBossThinking) return
      setIsBossThinking(true)
      try {
        const res = await bossAction({
          estado_actual: currentState,
          estimulo: stimulus,
        })
        const parsed = parseBossState(res.nuevo_estado)
        if (parsed) setMiniBossState(parsed)
        setMiniBossActionStore(res.accion as never)
      } catch (err) {
        console.error("[v0] Error consultando IA del mini-jefe", err)
      } finally {
        setIsBossThinking(false)
      }
    },
    [setMiniBossState, setMiniBossActionStore, setIsBossThinking],
  )

  // -------------------------------------------------------------------------
  // Sprint 4 - Reset del jefe al entrar/salir de la sala del jefe
  // (estado inicial = "A" / Patrullar). Ademas cancelamos cualquier
  // efecto de invisibilidad activo cuando salimos de mazmorra.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (bossPresent) {
      resetBoss()
      setKeySpawned(false)
      setKeyCollected(false)
    }
  }, [bossPresent, resetBoss])


  useEffect(() => {
    if (playerHp === 0) {
      setKeySpawned(false)
      setKeyCollected(false)
    }
  }, [playerHp])

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

      // Tomamos la posicion fresca del jugador y del jefe en cada tick.
      // Tarea 3.2: el jefe se mueve a 60fps; leemos su posicion via ref
      // para que el setInterval del polling no se reconstruya cada frame.
      const dist = distance(
        center(snap.playerPosition, PLAYER_SIZE),
        center(bossPositionRef.current, BOSS_SIZE),
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
    // playerPosition y bossPosition NO van aqui: los leemos via getState()
    // y bossPositionRef en cada tick para evitar re-crear el interval cada
    // vez que el jefe se mueve (a 60fps).
  }, [bossPresent, sendBossStimulus])

  // Polling para el Mini-Jefe: si estamos en sala secreta y esta vivo,
  // consulta constantemente su vista hacia el jugador.
  useEffect(() => {
    if (!secretBossPresent) return

    const intervalId = setInterval(() => {
      const snap = useGameStore.getState()
      if (snap.miniBossHp <= 0) return
      if (snap.isPlayerInvisible) return

      const playerCenter = center(snap.playerPosition, PLAYER_SIZE)
      const miniBossCenter = center(miniBossPositionRef.current, BOSS_SIZE)
      const dist = distance(miniBossCenter, playerCenter)

      const curState = snap.miniBossState
      if (dist <= VISION_RADIUS) {
        if (curState !== "C") {
          void sendMiniBossStimulus("v", curState)
        }
      }
    }, BOSS_TICK_MS)

    return () => clearInterval(intervalId)
  }, [secretBossPresent, sendMiniBossStimulus])

  // -------------------------------------------------------------------------
  // Sprint 4 - Handler de "usar pocion seleccionada" (tecla Q).
  // P4 (Invisibilidad), P1 (Curación Menor), P5 (Curación Mayor) tienen
  // efecto activo. Tras activar invisibilidad, si el jefe esta en B o C
  // disparamos el estimulo "p" para que el backend lo regrese a un estado calmo.
  // -------------------------------------------------------------------------
  const healPlayer = useGameStore((s) => s.healPlayer)

  // Pociones - flags de efectos activos
  const setIsPotionAimActive = useGameStore((s) => s.setIsPotionAimActive)
  const setIsSpeedActive = useGameStore((s) => s.setIsSpeedActive)
  const setIsMultiShotActive = useGameStore((s) => s.setIsMultiShotActive)
  const setIsHyperReflexesActive = useGameStore((s) => s.setIsHyperReflexesActive)
  const setIsShieldActive = useGameStore((s) => s.setIsShieldActive)
  const setIsExtremeCadenceActive = useGameStore((s) => s.setIsExtremeCadenceActive)

  const onUsePotion = useCallback(
    (id: PotionId) => {
      // P1: Curación Menor
      if (id === "P1") {
        healPlayer(POTION_P1_HEAL)
        pushNotification({ kind: "success", message: `Bebes la Pocion Menor de Curacion. +${POTION_P1_HEAL} HP.` })
        return
      }
      // P5: Curación Mayor
      if (id === "P5") {
        healPlayer(POTION_P5_HEAL)
        pushNotification({ kind: "success", message: `Bebes la Pocion de Curacion Mayor. +${POTION_P5_HEAL} HP.` })
        return
      }
      // P4: Invisibilidad
      if (id === "P4") {
        setPlayerInvisible(true)
        window.setTimeout(() => setPlayerInvisible(false), INVISIBILITY_MS)
        pushNotification({ kind: "success", message: "Bebes la Pocion de Invisibilidad. Te vuelves translucido." })
        const cur = useGameStore.getState().bossState
        if (bossPresent && (cur === "B" || cur === "C")) void sendBossStimulus("p", cur)
        return
      }
      // P2: Aceite de Punteria
      if (id === "P2") {
        setIsPotionAimActive(true)
        window.setTimeout(() => setIsPotionAimActive(false), POTION_AIM_MS)
        pushNotification({ kind: "success", message: `Aceite de Punteria activo (${POTION_AIM_MS / 1000}s). Dano x${AIM_POTION_DAMAGE_MULT}.` })
        return
      }
      // P3: Mezcla Volátil — ráfaga en 8 direcciones (push directo al ref)
      if (id === "P3") {
        const snap = useGameStore.getState()
        if (!bossPresent && !secretBossPresent) {
          pushNotification({ kind: "info", message: "No hay enemigos cerca para usar la Mezcla Volatil." })
          return
        }
        const cx = snap.playerPosition.x + 24
        const cy = snap.playerPosition.y + 24
        const dirs = [
          { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
          { dx: 0.707, dy: -0.707 }, { dx: -0.707, dy: -0.707 }, { dx: 0.707, dy: 0.707 }, { dx: -0.707, dy: 0.707 }
        ]
        for (const d of dirs) {
          proyectilesRef.current.push({ id: Date.now() + Math.random(), x: cx, y: cy, dx: d.dx, dy: d.dy, distanciaRecorrida: 0 })
        }
        pushNotification({ kind: "success", message: "¡BOOM! La Mezcla Volatil explota en 8 direcciones." })
        return
      }
      // P6: Velocidad de Movimiento
      if (id === "P6") {
        setIsSpeedActive(true)
        window.setTimeout(() => setIsSpeedActive(false), POTION_SPEED_MS)
        pushNotification({ kind: "success", message: `Velocidad aumentada (${POTION_SPEED_MS / 1000}s). ¡Esquiva mejor!` })
        return
      }
      // P7: Suero de Disparo Múltiple
      if (id === "P7") {
        setIsMultiShotActive(true)
        window.setTimeout(() => setIsMultiShotActive(false), POTION_MULTISHOT_MS)
        pushNotification({ kind: "success", message: `Disparo multiple activo (${POTION_MULTISHOT_MS / 1000}s). Triple proyectil.` })
        return
      }
      // P8: Tónico de Hiper-Reflejos
      if (id === "P8") {
        setIsHyperReflexesActive(true)
        window.setTimeout(() => setIsHyperReflexesActive(false), POTION_REFLEX_MS)
        pushNotification({ kind: "success", message: `Hiper-Reflejos activos (${POTION_REFLEX_MS / 1000}s). Cooldown de disparo reducido.` })
        return
      }
      // P9: Escudo de Energía
      if (id === "P9") {
        setIsShieldActive(true)
        window.setTimeout(() => setIsShieldActive(false), POTION_SHIELD_MS)
        pushNotification({ kind: "success", message: `¡Escudo de Energia activo (${POTION_SHIELD_MS / 1000}s)! Eres invencible.` })
        return
      }
      // P10: Brebaje de Cadencia Extrema
      if (id === "P10") {
        setIsExtremeCadenceActive(true)
        window.setTimeout(() => setIsExtremeCadenceActive(false), POTION_CADENCE_MS)
        pushNotification({ kind: "success", message: `Cadencia Extrema (${POTION_CADENCE_MS / 1000}s). ¡Dispara sin parar!` })
        return
      }

      // Fallback
      pushNotification({ kind: "info", message: `Has usado: ${POTION_NAMES[id]}.` })
    },
    [
      bossPresent, secretBossPresent, healPlayer, pushNotification, sendBossStimulus,
      setPlayerInvisible, setIsPotionAimActive, setIsSpeedActive, setIsMultiShotActive,
      setIsHyperReflexesActive, setIsShieldActive, setIsExtremeCadenceActive,
    ],
  )

  // Hotbar (Sprint 4): activo siempre que el jugador pueda jugar.
  useHotbarControls({
    enabled: movementEnabled,
    onUsePotion,
  })

  // -------------------------------------------------------------------------
  // Tarea 4 — Proyectiles del jugador (Batch Drawing, DOM-free).
  // Array mutable puro: React nunca lo observa → cero re-renders por disparo.
  // -------------------------------------------------------------------------
  const proyectilesRef = useRef<ProjectileState[]>([])
  // Cooldown entre disparos
  const lastShotAtRef = useRef<number>(0)
  // Cooldown de daño por trampas
  const lastHazardDamageTimeRef = useRef<number>(0)
  // Cooldown de advertencia de puerta sellada
  const lastExitWarnRef = useRef<number>(0)

  // Previene el comportamiento por defecto de la tecla J en el navegador durante el combate.
  useEffect(() => {
    if ((!bossPresent && !secretBossPresent) || !movementEnabled) return

    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "j") {
        e.preventDefault()
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [bossPresent, secretBossPresent, movementEnabled])

  // Limpia el array cuando el jugador abandona las salas de combate.
  useEffect(() => {
    if (!bossPresent && !secretBossPresent) {
      proyectilesRef.current = []
    }
  }, [bossPresent, secretBossPresent])

  // ===========================================================================
  // Tarea 3.2 - Game loop del Jefe.
  //
  // Un unico requestAnimationFrame que se encarga de TODO lo del jefe:
  //
  //   1. Movimiento segun bossState (Maquina de Moore)
  //        A -> patrullaje a velocidad 1 entre puntos aleatorios cercanos.
  //        B -> quieto (en C esta "buscando", no se mueve).
  //        C -> persecucion al jugador a velocidad 2.
  //
  //   2. Ataque (solo en estado C).
  //        - Cooldown BOSS_SHOOT_COOLDOWN_MS entre disparos.
  //        - Si NO esta en Modo Furia -> Ataque Basico apuntando al
  //          jugador (vector normalizado jefe -> jugador en el momento
  //          del disparo).
  //        - Si SI esta en Modo Furia -> 50% Basico, 50% Pesado.
  //
  //   3. Movimiento de los proyectiles del jefe + colision con el jugador.
  //        - Los proyectiles tienen distancia maxima:
  //            * Basico  -> BOSS_BASIC_PROJECTILE_MAX_DISTANCE
  //            * Pesado  -> BOSS_HEAVY_PROJECTILE_MAX_DISTANCE
  //        - Si un proyectil PESADO expira (por distancia o por salir del
  //          mundo) sin haber tocado al jugador, se FRAGMENTA en 8
  //          esquirlas basicas hacia las direcciones de ESQUIRLAS_8_DIR.
  //        - Si un proyectil toca al jugador (AABB con PLAYER_SIZE):
  //          console.log de impacto y se elimina. La logica de HP del
  //          jugador queda para una tarea posterior (3.3).
  // ---------------------------------------------------------------------------
  const [bossProyectiles, setBossProyectiles] = useState<BossProjectileState[]>([])
  const bossProyectilesRef = useRef<BossProjectileState[]>([])
  bossProyectilesRef.current = bossProyectiles
  // Id incremental para evitar choques entre proyectiles instanciados en el
  // mismo frame (las 8 esquirlas de la fragmentacion lo necesitan).
  const bossProjectileIdRef = useRef<number>(0)
  // Punto objetivo del patrullaje (estado A). null = aun no elegimos uno.
  const patrolTargetRef = useRef<Vector2D | null>(null)
  // Marca temporal del ultimo disparo del jefe (estado C). Usamos
  // performance.now() en ms.
  const lastBossShotAtRef = useRef<number>(0)

  useEffect(() => {
    if (!bossPresent && !secretBossPresent) {
      // Salimos de toda sala con enemigo: limpiamos proyectiles vivos.
      if (bossProyectilesRef.current.length > 0) setBossProyectiles([])
      patrolTargetRef.current = null
      lastBossShotAtRef.current = 0
      // Reiniciamos los estados de la metralleta si salimos de la sala
      isMachineGunRef.current = false
      nextMachineGunTimeRef.current = 0
      return
    }

    let rafId = 0
    const tick = () => {
      const snap = useGameStore.getState()
      const isMini = secretBossPresent
      const cur = isMini ? miniBossPositionRef.current : bossPositionRef.current
      const state = isMini ? snap.miniBossState : snap.bossState
      const isAlive = isMini ? snap.miniBossHp > 0 : snap.bossLives > 0
      const furious = isMini ? false : snap.isBossFurious
      // El mini-boss se mueve a la mitad de velocidad del jefe principal.
      const speedMult = isMini ? 0.5 : 1

      let nextBossPos: Vector2D = cur
      let pendingSpawn: BossProjectileState | null = null

      if (isAlive) {
        // -------- 1) Movimiento del jefe/mini-jefe segun el estado de Moore --------
        if (state === "A") {
          // Patrullaje.
          const reached =
            !patrolTargetRef.current ||
            distance(cur, patrolTargetRef.current) <= BOSS_PATROL_REACHED_EPSILON
          if (reached) {
            const angle = Math.random() * Math.PI * 2
            const radius = Math.random() * BOSS_PATROL_RADIUS
            patrolTargetRef.current = {
              x: clampX(cur.x + Math.cos(angle) * radius),
              y: clampY(cur.y + Math.sin(angle) * radius),
            }
          }
          nextBossPos = stepTowards(
            cur,
            patrolTargetRef.current!,
            BOSS_PATROL_SPEED * speedMult,
          )
        } else if (state === "B") {
          // Buscar: el jefe se queda quieto.
          patrolTargetRef.current = null
        } else {
          // C - Atacar.
          patrolTargetRef.current = null
          const playerCenter = center(snap.playerPosition, PLAYER_SIZE)
          const bossCenter = center(cur, BOSS_SIZE)
          const distToPlayer = distance(bossCenter, playerCenter)

          if (isMini) {
            // ==========================================
            // LÓGICA DE MOVIMIENTO DE LOS MINI-JEFES
            // ==========================================
            const miniType = getMiniBossType(currentNode?.id ?? 0)

            if (miniType === "ghost") {
              // Teletransporte del fantasma cada 2.5s
              const nowTime = performance.now()
              if (nowTime - lastGhostTeleportRef.current >= 2500) {
                lastGhostTeleportRef.current = nowTime
                const angle = Math.random() * Math.PI * 2
                const radius = 130 + Math.random() * 70 // 130 a 200px
                const targetX = playerCenter.x + Math.cos(angle) * radius - BOSS_SIZE.width / 2
                const targetY = playerCenter.y + Math.sin(angle) * radius - BOSS_SIZE.height / 2
                const clampedX = Math.max(BOSS_WORLD_MARGIN, Math.min(WORLD_SIZE.width - BOSS_SIZE.width - BOSS_WORLD_MARGIN, targetX))
                const clampedY = Math.max(BOSS_WORLD_MARGIN, Math.min(WORLD_SIZE.height - BOSS_SIZE.height - BOSS_WORLD_MARGIN, targetY))

                nextBossPos = { x: clampedX, y: clampedY }

                pushNotification({
                  kind: "info",
                  message: "¡El Fantasma se desvanece y se teletransporta!",
                })
              } else {
                if (distToPlayer > BOSS_MIN_DISTANCE_TO_PLAYER) {
                  const target: Vector2D = {
                    x: playerCenter.x - BOSS_SIZE.width / 2,
                    y: playerCenter.y - BOSS_SIZE.height / 2,
                  }
                  // Vuelve a su velocidad de caminata anterior constante (1.5) sin suavizado (Lerp)
                  nextBossPos = stepTowards(cur, target, BOSS_ATTACK_SPEED * speedMult)
                }
              }
            } else {
              // Esqueleto o Bruja: persiguen al jugador directamente
              if (distToPlayer > BOSS_MIN_DISTANCE_TO_PLAYER) {
                const target: Vector2D = {
                  x: playerCenter.x - BOSS_SIZE.width / 2,
                  y: playerCenter.y - BOSS_SIZE.height / 2,
                }
                // Vuelven a su velocidad anterior constante (1.5) sin suavizado (Lerp)
                nextBossPos = stepTowards(cur, target, BOSS_ATTACK_SPEED * speedMult)
              }
            }
          } else {
            // ==========================================
            // LÓGICA DEL JEFE PRINCIPAL
            // ==========================================
            const nowTime = performance.now()

            // 1. Iniciar el temporizador de metralleta cuando entra en furia por primera vez
            if (furious && nextMachineGunTimeRef.current === 0) {
              nextMachineGunTimeRef.current = nowTime + 3000 // Primer ataque en 3s
            }

            // 2. Control de los estados de la metralleta
            if (furious) {
              if (!isMachineGunRef.current && nowTime > nextMachineGunTimeRef.current) {
                // Iniciar la ráfaga
                isMachineGunRef.current = true
                machineGunEndTimeRef.current = nowTime + 2000 // Dura 2 segundos
                pushNotification({ kind: "error", message: "¡El Jefe está preparando una ráfaga imparable!" })
              } else if (isMachineGunRef.current && nowTime > machineGunEndTimeRef.current) {
                // Terminar la ráfaga y calcular la siguiente
                isMachineGunRef.current = false
                nextMachineGunTimeRef.current = nowTime + 4000 + Math.random() * 3000 // Próxima entre 4 y 7s
              }
            }

            // 3. Velocidad y aceleración según la fase
            let currentAttackSpeed = BOSS_ATTACK_SPEED

            if (furious) {
              // Fase 2 (Furia): Vuelve a su velocidad anterior constante (3.0) sin suavizado de Lerp
              currentAttackSpeed = BOSS_ATTACK_SPEED // 3.0
            } else {
              // Fase 1: Conserva su velocidad actual con suavizado de Lerp hacia targetSpeed = 2.0
              const targetSpeed = 2.0
              bossCurrentSpeedRef.current += (targetSpeed - bossCurrentSpeedRef.current) * 0.02
              currentAttackSpeed = bossCurrentSpeedRef.current
            }

            // Si está en modo ráfaga, frenarlo a 0.0
            if (isMachineGunRef.current) {
              currentAttackSpeed = 0.0
            }

            // Mover al jefe principal
            if (distToPlayer > BOSS_MIN_DISTANCE_TO_PLAYER) {
              const target: Vector2D = {
                x: playerCenter.x - BOSS_SIZE.width / 2,
                y: playerCenter.y - BOSS_SIZE.height / 2,
              }
              nextBossPos = stepTowards(cur, target, currentAttackSpeed * speedMult)
            }
          }
        }

        // Clamp final a los bordes del mundo (defensivo).
        nextBossPos = {
          x: clampX(nextBossPos.x),
          y: clampY(nextBossPos.y),
        }

        if (nextBossPos.x !== cur.x || nextBossPos.y !== cur.y) {
          if (isMini) {
            miniBossPositionRef.current = nextBossPos
            setMiniBossPosition(nextBossPos)
          } else {
            bossPositionRef.current = nextBossPos
            setBossPosition(nextBossPos)
          }
        }

        // -------- 2) Ataque del jefe / mini-jefe (solo en estado C) --------
        const now = performance.now()
        if (state === "C") {
          if (isMini) {
            const miniType = getMiniBossType(currentNode?.id ?? 0)
            if (miniType === "witch") {
              if (now - lastBossShotAtRef.current >= MINI_BOSS_SHOOT_COOLDOWN_MS) {
                lastBossShotAtRef.current = now
                pendingSpawn = buildBossShotAtPlayer(false, cur, "poison")
              }
            } else {
              if (now - lastBossShotAtRef.current >= MINI_BOSS_SHOOT_COOLDOWN_MS) {
                lastBossShotAtRef.current = now
                pendingSpawn = buildBossShotAtPlayer(false, cur, "basic")
              }
            }
          } else {
            // ----------- DISPARO DEL JEFE PRINCIPAL -----------
            // Si es metralleta dispara cada 150ms, sino usa su cooldown normal
            const currentCooldown = isMachineGunRef.current ? 150 : BOSS_SHOOT_COOLDOWN_MS

            if (now - lastBossShotAtRef.current >= currentCooldown) {
              lastBossShotAtRef.current = now
              // Le pasamos el parámetro extra "isMachineGun" para evitar pesados en la ráfaga
              pendingSpawn = buildBossShotAtPlayer(furious, cur, "basic", isMachineGunRef.current)
            }
          }
        }
      } // Fin if isAlive

      // -------- 3) Movimiento de los proyectiles del jefe + colisiones --------
      stepBossProjectiles(snap.playerPosition, pendingSpawn)

      rafId = requestAnimationFrame(tick)
    }

    // Helper: clampea un valor X al area jugable del mundo (con margen).
    function clampX(x: number): number {
      return Math.max(
        BOSS_WORLD_MARGIN,
        Math.min(WORLD_SIZE.width - BOSS_SIZE.width - BOSS_WORLD_MARGIN, x),
      )
    }
    function clampY(y: number): number {
      return Math.max(
        BOSS_WORLD_MARGIN,
        Math.min(WORLD_SIZE.height - BOSS_SIZE.height - BOSS_WORLD_MARGIN, y),
      )
    }

    // Helper: avanza `from` hacia `to` un maximo de `speed` pixeles.
    function stepTowards(
      from: Vector2D,
      to: Vector2D,
      speed: number,
    ): Vector2D {
      const dx = to.x - from.x
      const dy = to.y - from.y
      const len = Math.sqrt(dx * dx + dy * dy)
      if (len <= speed) return to
      return {
        x: from.x + (dx / len) * speed,
        y: from.y + (dy / len) * speed,
      }
    }

    // Helper: construye un proyectil del jefe apuntando al jugador.
    function buildBossShotAtPlayer(
      furious: boolean,
      bossC_topleft: Vector2D,
      projKind: BossProjectileKind = "basic",
      isMachineGun: boolean = false // <--- Agregado parámetro
    ): BossProjectileState | null {
      const playerC = center(
        useGameStore.getState().playerPosition,
        PLAYER_SIZE,
      )
      const bossC = center(bossC_topleft, BOSS_SIZE)
      const vx = playerC.x - bossC.x
      const vy = playerC.y - bossC.y
      const len = Math.sqrt(vx * vx + vy * vy)

      // Defensa: si por casualidad coinciden centros, no disparamos.
      if (len === 0) return null

      if (projKind === "poison") {
        bossProjectileIdRef.current += 1
        return {
          id: bossProjectileIdRef.current,
          x: bossC.x,
          y: bossC.y,
          dx: vx / len,
          dy: vy / len,
          distanciaRecorrida: 0,
          kind: "poison",
        }
      }

      // LA MAGIA DE LA PROBABILIDAD:
      // Si está furioso Y NO está en ráfaga (metralleta), hay un 50% de ataque pesado.
      // Si está en ráfaga, useHeavy es siempre false (solo bolitas rojas).
      const useHeavy = furious && !isMachineGun && Math.random() <= 0.5
      bossProjectileIdRef.current += 1
      return {
        id: bossProjectileIdRef.current,
        x: bossC.x,
        y: bossC.y,
        dx: vx / len,
        dy: vy / len,
        distanciaRecorrida: 0,
        kind: useHeavy ? "heavy" : "basic",
      }
    }

    // Helper: avanza todos los proyectiles del jefe, los descarta si
    // expiran (con fragmentacion para los pesados) y revisa AABB contra el jugador.
    function stepBossProjectiles(
      playerPos: Vector2D,
      pendingSpawn: BossProjectileState | null,
    ) {
      const current = bossProyectilesRef.current
      if (current.length === 0 && !pendingSpawn) return

      const esquirlasGeneradas: BossProjectileState[] = []
      const next: BossProjectileState[] = []

      for (const p of current) {
        const speed =
          p.kind === "heavy"
            ? BOSS_HEAVY_PROJECTILE_SPEED
            : BOSS_BASIC_PROJECTILE_SPEED
        const maxDist =
          p.kind === "heavy"
            ? BOSS_HEAVY_PROJECTILE_MAX_DISTANCE
            : BOSS_BASIC_PROJECTILE_MAX_DISTANCE
        const projSize =
          p.kind === "heavy"
            ? BOSS_HEAVY_PROJECTILE_SIZE
            : BOSS_BASIC_PROJECTILE_SIZE

        const nx = p.x + p.dx * speed
        const ny = p.y + p.dy * speed
        const nDist = p.distanciaRecorrida + speed

        const fueraDelMundo =
          nx < -projSize.width ||
          nx > WORLD_SIZE.width + projSize.width ||
          ny < -projSize.height ||
          ny > WORLD_SIZE.height + projSize.height
        if (fueraDelMundo) continue

        if (nDist > maxDist) {
          if (p.kind === "heavy") {
            for (const dir of ESQUIRLAS_8_DIR) {
              bossProjectileIdRef.current += 1
              esquirlasGeneradas.push({
                id: bossProjectileIdRef.current,
                x: nx,
                y: ny,
                dx: dir.dx,
                dy: dir.dy,
                distanciaRecorrida: 0,
                kind: "basic",
              })
            }
          }
          continue
        }

        const projPos: Vector2D = {
          x: nx - projSize.width / 2,
          y: ny - projSize.height / 2,
        }
        if (intersectsAABB(projPos, projSize, playerPos, PLAYER_SIZE)) {
          const isShielded = useGameStore.getState().isShieldActive
          if (isShielded) continue

          const damage = p.kind === "heavy"
            ? BOSS_HEAVY_PROJECTILE_DAMAGE
            : p.kind === "poison"
              ? 15
              : BOSS_BASIC_PROJECTILE_DAMAGE
          const currentPlayerHp = useGameStore.getState().playerHp

          if (currentPlayerHp > 0) {
            void combatHit({
              hp_actual: currentPlayerHp,
              dano_recibido: damage,
            }).then((res) => {
              useGameStore.getState().setPlayerHp(res.hp_resultante)
              useGameStore.getState().setPlayerHealthFlash(true)
              if (p.kind === "poison") {
                pushNotification({
                  kind: "error",
                  message: "¡La pócima de veneno de la Bruja te impacta! -15 HP (Sustracción propia de Turing)",
                })
              }
              if (res.hp_resultante === 0) {
                useGameStore.getState().resetBoss()
                setBossProyectiles([])
              }
            }).catch((err) => {
              console.error("[v0] Error en combatHit (jugador):", err)
            })
          }
          continue
        }

        next.push({ ...p, x: nx, y: ny, distanciaRecorrida: nDist })
      }

      const result: BossProjectileState[] = next
      if (esquirlasGeneradas.length > 0) result.push(...esquirlasGeneradas)
      if (pendingSpawn) result.push(pendingSpawn)

      if (
        result.length !== current.length ||
        result.some((p, i) => p !== current[i])
      ) {
        setBossProyectiles(result)
      }
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [bossPresent, secretBossPresent])

  // ---------------------------------------------------------------------------
  // Modo Furia del Jefe (activado automáticamente cuando pierde su primera vida).
  // ---------------------------------------------------------------------------
  const isBossFurious = useGameStore((s) => s.isBossFurious)

  // Refs para que drawDungeon lea bossPresent/secretBossPresent sin stale closure.
  const bossRoomRef = useRef(bossPresent)
  bossRoomRef.current = bossPresent
  const secretBossRoomRef = useRef(secretBossPresent)
  secretBossRoomRef.current = secretBossPresent
  const movementEnabledRef = useRef(movementEnabled)
  movementEnabledRef.current = movementEnabled

  // Ref a la textura del jugador (evita drawImage con string crudo)
  const playerSpriteRef = useRef<HTMLImageElement | null>(null)
  useEffect(() => {
    loadImage(spritesheetUrl).then((img) => { playerSpriteRef.current = img })
  }, [])

  // Dibujo del lienzo base + jugador (sprite clipping LPC).
  const drawDungeon = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    // Fondo plano de mazmorra (piedra oscura)
    const bg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.75)
    bg.addColorStop(0, "#1e293b")
    bg.addColorStop(0.6, "#0f172a")
    bg.addColorStop(1, "#020617")
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)

    // Rejilla técnica de 40px
    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)"
    ctx.lineWidth = 0.5
    for (let x = 0; x <= w; x += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
    }
    for (let y = 0; y <= h; y += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
    }

    // Vignette spotlight de antorcha (solo fuera de la sala del jefe)
    const state = useGameStore.getState()
    if (!bossRoomRef.current) {
      const cx = state.playerPosition.x + PLAYER_SIZE.width / 2
      const cy = state.playerPosition.y + PLAYER_SIZE.height / 2
      const vign = ctx.createRadialGradient(cx, cy, 28, cx, cy, 140)
      vign.addColorStop(0, "rgba(3,7,18,0)")
      vign.addColorStop(1, "rgba(3,7,18,0.98)")
      ctx.fillStyle = vign
      ctx.fillRect(0, 0, w, h)
    }

    // --- Proyectiles del jugador (Batch Drawing, Tarea 4) ---
    // Generación de proyectiles continua al mantener presionada la tecla J (sin re-renders de React)
    if (movementEnabledRef.current && (bossRoomRef.current || secretBossRoomRef.current) && keysRef.current.has("j")) {
      const now = performance.now()
      const snap = useGameStore.getState()
      const dir = snap.lastDirection
      if (dir.x !== 0 || dir.y !== 0) {
        const effectiveCooldown = snap.isExtremeCadenceActive
          ? 0
          : snap.isHyperReflexesActive
            ? SHOOT_COOLDOWN_MS / 2
            : SHOOT_COOLDOWN_MS
        if (now - lastShotAtRef.current >= effectiveCooldown) {
          lastShotAtRef.current = now
          const cx = snap.playerPosition.x + 24
          const cy = snap.playerPosition.y + 24
          if (snap.isMultiShotActive) {
            const angle = Math.atan2(dir.y, dir.x)
            const spread = Math.PI / 10
            for (const off of [-spread, 0, spread]) {
              proyectilesRef.current.push({
                id: Date.now() + Math.random(),
                x: cx, y: cy,
                dx: Math.cos(angle + off),
                dy: Math.sin(angle + off),
                distanciaRecorrida: 0,
              })
            }
          } else {
            proyectilesRef.current.push({
              id: Date.now(),
              x: cx, y: cy,
              dx: dir.x, dy: dir.y,
              distanciaRecorrida: 0,
            })
          }
        }
      }
    }

    // Física + colisión + dibujo en el mismo frame; DOM permanece estático.
    const projs = proyectilesRef.current
    for (let i = projs.length - 1; i >= 0; i--) {
      const p = projs[i]
      p.x += p.dx * PROJECTILE_SPEED
      p.y += p.dy * PROJECTILE_SPEED
      p.distanciaRecorrida += PROJECTILE_SPEED

      // Limpieza por distancia / fuera de pantalla
      if (
        p.distanciaRecorrida > PROJECTILE_MAX_DISTANCE ||
        p.x < 0 || p.x > w || p.y < 0 || p.y > h
      ) {
        projs.splice(i, 1)
        continue
      }

      // AABB hit vs jefe activo
      const projPos: Vector2D = { x: p.x - PROJECTILE_SIZE.width / 2, y: p.y - PROJECTILE_SIZE.height / 2 }
      let targetPos: Vector2D | null = null
      if (bossRoomRef.current) targetPos = bossPositionRef.current
      else if (secretBossRoomRef.current) targetPos = miniBossPositionRef.current

      if (targetPos && intersectsAABB(projPos, PROJECTILE_SIZE, targetPos, BOSS_SIZE)) {
        projs.splice(i, 1)
        if (bossRoomRef.current) {
          const curState = useGameStore.getState().bossState
          if (curState !== "C") {
            void bossAction({ estado_actual: curState, estimulo: "h" }).then((res) => {
              const ns = parseBossState(res.nuevo_estado)
              if (ns) { useGameStore.getState().setBossState(ns); useGameStore.getState().setBossAction(res.accion as BossAction) }
            })
          }
          const phaseAtHit = useGameStore.getState().bossLives
          const hpAtHit = useGameStore.getState().bossHp
          if (phaseAtHit > 0) {
            const aimMult = useGameStore.getState().isPotionAimActive ? AIM_POTION_DAMAGE_MULT : 1
            void combatHit({ hp_actual: hpAtHit, dano_recibido: Math.round(PLAYER_PROJECTILE_DAMAGE * aimMult) }).then((res) => {
              const s = useGameStore.getState()
              if (s.bossLives !== phaseAtHit || s.bossLives === 0) return
              s.applyBossDamage(res.hp_resultante)
              if (res.hp_resultante === 0 && useGameStore.getState().bossLives === 0) {
                setKeySpawned(true)
                setKeyPosition({ ...bossPositionRef.current })
                pushNotification({ kind: "success", message: "¡El Jefe ha sido derrotado! Una Llave Dorada aparece sobre un pedestal." })
              }
            })
          }
        } else if (secretBossRoomRef.current) {
          const curState = useGameStore.getState().miniBossState
          if (curState !== "C") {
            void bossAction({ estado_actual: curState, estimulo: "h" }).then((res) => {
              const ns = parseBossState(res.nuevo_estado)
              if (ns) { useGameStore.getState().setMiniBossState(ns); useGameStore.getState().setMiniBossAction(res.accion as never) }
            })
          }
          const hp = useGameStore.getState().miniBossHp
          const node = currentNodeRef.current
          if (hp > 0 && node) {
            const aimMult = useGameStore.getState().isPotionAimActive ? AIM_POTION_DAMAGE_MULT : 1
            void combatHit({ hp_actual: hp, dano_recibido: Math.round(PLAYER_PROJECTILE_DAMAGE * aimMult) }).then((res) => {
              if (useGameStore.getState().miniBossHp === 0) return
              useGameStore.getState().applyMiniBossDamage(node.id, res.hp_resultante)
            })
          }
        }
        continue
      }

      // Near miss (solo jefe principal)
      if (!p.triggeredNearMiss && bossRoomRef.current && targetPos) {
        const bossCenter = center(bossPositionRef.current, BOSS_SIZE)
        const distToBoss = distance({ x: p.x, y: p.y }, bossCenter)
        const nearMissThreshold = Math.max(BOSS_SIZE.width, BOSS_SIZE.height) / 2 + BOSS_NEAR_MISS_THRESHOLD
        if (distToBoss < nearMissThreshold) {
          p.triggeredNearMiss = true
          const curState = useGameStore.getState().bossState
          if (curState !== "C") {
            void bossAction({ estado_actual: curState, estimulo: "h" }).then((res) => {
              const ns = parseBossState(res.nuevo_estado)
              if (ns) { useGameStore.getState().setBossState(ns); useGameStore.getState().setBossAction(res.accion as BossAction) }
            })
          }
        }
      }

      // Dibujo con halo incandescente (GPU shadowBlur)
      ctx.save()
      ctx.shadowBlur = 8
      ctx.shadowColor = "#eab308"
      ctx.fillStyle = "#eab308"
      ctx.beginPath()
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    // --- Jugador (sprite clipping LPC) ---
    // Fila LPC: 8=Arriba, 9=Izquierda, 10=Abajo, 11=Derecha
    let row = 10
    if (Math.abs(state.lastDirection.x) > Math.abs(state.lastDirection.y)) {
      row = state.lastDirection.x > 0 ? 11 : 9
    } else {
      row = state.lastDirection.y < 0 ? 8 : 10
    }
    // Animación gated por tiempo físico (sin setInterval ni estado React)
    const frameIndex = state.isPlayerMoving ? Math.floor(performance.now() / 80) % 9 : 0

    if (playerSpriteRef.current) {
      // Opacidad reducida si el jugador es invisible
      ctx.globalAlpha = state.isPlayerInvisible ? 0.4 : 1
      ctx.drawImage(
        playerSpriteRef.current,
        frameIndex * SPRITE_SIZE, row * SPRITE_SIZE, SPRITE_SIZE, SPRITE_SIZE,
        state.playerPosition.x - 8, state.playerPosition.y - 12, SPRITE_SIZE, SPRITE_SIZE,
      )
      ctx.globalAlpha = 1
    }
  // playerSpriteRef es un ref estable; no va en deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const canvasRef = useCanvasLoop({ width: WORLD_SIZE.width, height: WORLD_SIZE.height, draw: drawDungeon })

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <div
        className="relative overflow-hidden rounded-2xl border-2 border-border shadow-2xl"
        style={{ width: WORLD_SIZE.width, height: WORLD_SIZE.height }}
      >
        {/* Canvas base: fondo + vignette + jugador (todo en el mismo buffer) */}
        <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }} aria-hidden />

        {/* Habitacion (fondo + decoracion segun tipo) */}
        {currentNode && (
          <DungeonRoom type={currentNode.tipo} worldSize={WORLD_SIZE} />
        )}


        {/* Portal de salida (solo en la sala inicial) */}
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
              destType={nodeMap.get(cid)?.tipo}
            />
          ))}

        {/* Puerta hacia el padre (direccion = de donde vino el jugador) */}
        {currentConfig && currentConfig.backDir !== null && parentId !== null && (
          <DoorTile
            dir={currentConfig.backDir}
            variant="back"
            destId={parentId}
            locked={currentNode?.tipo === "jefe" && bossLives > 0}
          />
        )}

        {/* Jefe (solo en la sala con tipo "jefe" sin hijos) */}
        {bossPresent && bossLives > 0 && (
          <Boss position={bossPosition} size={BOSS_SIZE} state={bossState} />
        )}

        {/* Mini-Boss (solo en salas secretas) */}
        {secretBossPresent && miniBossHp > 0 && currentNode && (
          <MiniBoss
            position={miniBossPosition}
            size={BOSS_SIZE}
            state={miniBossState}
            type={getMiniBossType(currentNode.id)}
          />
        )}

        {/* Proyectiles del JEFE (Tarea 3.2).
            Van debajo de los del jugador para que en una colision visual
            el del jugador "tape" al del jefe. */}
        {bossProyectiles.map((p) => (
          <Projectile
            key={`boss-${p.id}`}
            x={p.x}
            y={p.y}
            size={
              p.kind === "heavy"
                ? BOSS_HEAVY_PROJECTILE_SIZE.width
                : BOSS_BASIC_PROJECTILE_SIZE.width
            }
            variant={
              p.kind === "heavy"
                ? "boss-heavy"
                : p.kind === "poison"
                  ? "boss-poison"
                  : "boss-basic"
            }
          />
        ))}

        {/* Proyectiles del jugador: dibujados en canvas (ver drawDungeon) */}

        {/* Ingredientes esparcidos por la sala (si los hay) */}
        {currentNode?.ingredientes && currentNode.ingredientes.map((ing, idx) => {
          if (!ing) return null

          const seedX = currentNode.id * 100 + idx
          const seedY = currentNode.id * 100 + idx + 50
          const x = 150 + pseudoRandom(seedX) * (WORLD_SIZE.width - 300)
          const y = 150 + pseudoRandom(seedY) * (WORLD_SIZE.height - 300)

          return (
            <IngredientItem
              key={`${currentNode.id}-${idx}`}
              ingredient={ing}
              position={{ x, y }}
              size={INGREDIENT_SIZE}
            />
          )
        })}

        {/* Cofre Secreto (Aparece tras derrotar al mini-jefe) */}
        {currentNode?.tipo === "sala" && currentNode.enemigo_derrotado && !currentNode.pociones_reclamadas && (
          <GiOpenTreasureChest
            className="absolute z-20 text-amber-300 drop-shadow-lg animate-pulse"
            size={140}
            style={{
              left: WORLD_SIZE.width - 180,
              top: 60,
            }}
            aria-hidden
          />
        )}

        {/* Llave de Oro de la Victoria sobre Pedestal de Luz */}
        {keySpawned && !keyCollected && (
          <div
            className="absolute z-20 flex items-center justify-center pointer-events-none animate-fade-in"
            style={{
              left: keyPosition.x,
              top: keyPosition.y,
              width: BOSS_SIZE.width,
              height: BOSS_SIZE.height,
            }}
          >
            {/* Pedestal de luz vertical */}
            <div
              className="absolute bottom-0 w-16 h-40 bg-gradient-to-t from-yellow-500/40 via-yellow-400/20 to-transparent rounded-full blur-md animate-pulse"
              style={{
                transform: "translateY(20px)",
              }}
              aria-hidden
            />
            {/* Halo brillante en la base */}
            <div
              className="absolute bottom-0 w-12 h-4 bg-yellow-500/50 rounded-full blur-sm animate-pulse"
              style={{
                transform: "translateY(35px) scaleY(0.3)",
              }}
              aria-hidden
            />
            {/* Llave Dorada rebotando */}
            <GiKey
              className="relative text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.95)] animate-bounce"
              size={48}
              style={{
                animationDuration: "2s",
              }}
            />
          </div>
        )}

        {/* Peligros en el suelo (z-index: 5) */}
        {currentNode && generateHazards(currentNode).map((h) => (
          <HazardTile
            key={h.id}
            hazard={h}
            playerPos={playerPosition}
          />
        ))}

        {/* El jugador se dibuja directamente en el canvas (ver drawDungeon) */}

        {/* Tarea 3.3: Barra de vida del Jefe (solo en la sala del jefe) */}
        {bossPresent && bossLives > 0 && <BossHealthBar />}

        {/* Barra de vida del Mini-Boss (solo en salas secretas) */}
        {secretBossPresent && miniBossHp > 0 && <MiniBossHealthBar />}

        {/* Tarea 3.3: Barra de vida del Jugador */}
        <PlayerHealthBar />

        {/* HUD compartido (inventario + controles + hotbar
            integrada en la columna izquierda - Sprint Polish-Pass T1). */}
        <HUD />

        {/* Etiqueta de la sala actual (top center).
            Tarea 3.3: cuando está el jefe, la etiqueta se mueve más abajo
            para no tapar la barra de vida del jefe. */}
        {currentNode && (
          <div className={`pointer-events-none absolute left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-1 ${bossPresent ? "top-16" : "top-4"
            }`}>
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
            - Botones de regenerar y salir, sin tapar al jefe (lateral inf.)
            - Tarea 3.2: badge de Modo Furia + boton debug para activarlo. */}
        {bossPresent && (
          <div className="pointer-events-none absolute bottom-12 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-2">
            <div
              className={`rounded-md border px-3 py-1.5 text-center shadow backdrop-blur ${isBossFurious
                ? "border-purple-500/70 bg-background/90"
                : "border-red-500/40 bg-background/85"
                }`}
            >
              <p className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-red-300">
                <GiSkullCrossedBones size={14} />
                IA del Jefe: estado {bossState}
                {isBossThinking && (
                  <GiVortex size={12} className="animate-spin text-amber-300" />
                )}
                {isBossFurious && (
                  <span className="ml-1 rounded bg-purple-700 px-1.5 py-0 text-[10px] font-extrabold text-purple-100 animate-pulse">
                    FURIA
                  </span>
                )}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {bossState === "A"
                  ? "Patrulla relajada"
                  : bossState === "B"
                    ? "En busqueda - alerta"
                    : isBossFurious
                      ? "Atacando con FURIA - cuidado con los proyectiles morados"
                      : "Atacando - ¡huye o usa Invisibilidad!"}
              </p>
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
        <Notifications />
      </div>


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
  destType,
  locked,
}: {
  dir: DoorDir
  variant: "forward" | "back"
  destId: number
  destType?: string
  locked?: boolean
}) {
  const { pos, size } = DOOR_RECTS[dir]
  const isHorizontal = dir === "top" || dir === "bottom"
  const isBack = variant === "back"
  const isBossDoor = destType === "jefe"

  // Clases y colores
  let haloClass = isBack ? "bg-slate-400/30" : "bg-amber-300/40"
  let borderClass = isBack ? "border-slate-300/70" : "border-amber-300/80"
  let shadowColor = isBack ? "rgba(203, 213, 225, 0.4)" : "rgba(252, 211, 77, 0.6)"

  if (locked) {
    haloClass = "bg-purple-900/60"
    borderClass = "border-purple-600/90"
    shadowColor = "rgba(168, 85, 247, 0.9)"
  } else if (isBossDoor) {
    haloClass = "bg-red-900/50 animate-pulse"
    borderClass = "border-red-500/80"
    shadowColor = "rgba(239, 68, 68, 0.9)"
  }

  return (
    <div
      className="absolute z-20 flex items-center justify-center"
      style={{
        left: pos.x,
        top: pos.y,
        width: size.width,
        height: size.height,
      }}
      aria-label={`Puerta ${isBack ? "atras" : "adelante"} hacia sala ${destId} ${locked ? "(SELLADA)" : ""}`}
    >
      {/* Halo de la puerta */}
      <div
        className={`absolute inset-0 rounded-sm ${haloClass} animate-pulse`}
        aria-hidden
      />
      {/* Marco de la puerta */}
      <div
        className={`absolute inset-0 border-2 ${borderClass}`}
        style={{
          borderRadius: 4,
          boxShadow: `0 0 20px ${shadowColor}`,
        }}
        aria-hidden
      />
      {/* Icono */}
      {locked ? (
        <GiSkullCrossedBones
          className="relative text-purple-300 drop-shadow animate-bounce-slow"
          size={isHorizontal ? size.height : size.width}
        />
      ) : isBossDoor ? (
        <GiSkullCrossedBones
          className="relative text-red-300 drop-shadow animate-pulse"
          size={isHorizontal ? size.height : size.width}
        />
      ) : isBack ? (
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

function HazardTile({
  hazard,
  playerPos,
}: {
  hazard: Hazard
  playerPos: Vector2D
}) {
  const isLava = hazard.type === "lava"
  const dist = distance(
    center(playerPos, PLAYER_SIZE),
    center(hazard.position, hazard.size)
  )
  // La antorcha ilumina 140px, dejamos 160px para el efecto de borde luminoso
  const inLight = dist <= 160

  // Generar un borde de charco orgánico determinista para cada lava basado en su ID/posición
  const puddleBorderRadius = isLava
    ? `${35 + (hazard.position.x % 15)}% ${55 + (hazard.position.y % 15)}% ${40 + (hazard.position.x % 20)}% ${50 + (hazard.position.y % 20)}% / ${45 + (hazard.position.y % 15)}% ${45 + (hazard.position.x % 15)}% ${55 + (hazard.position.y % 20)}% ${50 + (hazard.position.x % 20)}%`
    : "12px" // 12px equivale a rounded-xl

  return (
    <div
      className={`absolute overflow-hidden flex items-center justify-center border ${isLava
        ? "border-orange-500/80 shadow-[inset_0_0_10px_rgba(124,45,18,0.7)]"
        : "border-slate-800/80"
        }`}
      style={{
        left: hazard.position.x,
        top: hazard.position.y,
        width: hazard.size.width,
        height: hazard.size.height,
        borderRadius: puddleBorderRadius,
        background: isLava
          ? "radial-gradient(circle, #f97316 20%, #ea580c 60%, #7c2d12 100%)"
          : "none",
        boxShadow: isLava && inLight ? "0 0 18px rgba(234, 88, 12, 0.75)" : "none",
        zIndex: 5, // Debajo de la capa de oscuridad (z-12)
      }}
    >
      {isLava ? (
        <div className="relative w-full h-full">
          <div className="absolute inset-0 bg-orange-500/20 mix-blend-overlay animate-pulse" />
          {/* Boiling bubbles */}
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 absolute opacity-70 animate-bubble" style={{ left: "12px", bottom: "8px", animationDelay: "0.2s" }} />
          <div className="w-2 h-2 rounded-full bg-orange-400 absolute opacity-80 animate-bubble" style={{ left: "34px", bottom: "14px", animationDelay: "0.8s" }} />
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-300 absolute opacity-90 animate-bubble" style={{ left: "22px", bottom: "28px", animationDelay: "1.4s" }} />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 absolute opacity-70 animate-bubble" style={{ left: "44px", bottom: "6px", animationDelay: "2.0s" }} />
        </div>
      ) : (
        /* High Definition 3D Vector Spikes SVG on Cracked Dark Stone */
        <svg viewBox="0 0 64 64" className="w-full h-full select-none pointer-events-none">
          <defs>
            <radialGradient id="cracked-stone" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#475569" />
              <stop offset="60%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f172a" />
            </radialGradient>
            <linearGradient id="metal-light" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f1f5f9" />
              <stop offset="50%" stopColor="#cbd5e1" />
              <stop offset="100%" stopColor="#64748b" />
            </linearGradient>
            <linearGradient id="metal-dark" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#475569" />
              <stop offset="70%" stopColor="#334155" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
          </defs>

          {/* Cracked stone backdrop */}
          <rect width="64" height="64" fill="url(#cracked-stone)" />

          {/* Subtle rock cracks */}
          <path d="M 0 10 L 20 25 L 35 15 L 64 45 M 10 64 L 25 45 L 20 25 M 64 12 L 44 20 L 48 44 L 25 45" stroke="#020617" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.65" />
          <path d="M 0 10 L 20 25 L 35 15 L 64 45 M 10 64 L 25 45 L 20 25 M 64 12 L 44 20 L 48 44 L 25 45" stroke="#475569" strokeWidth="0.5" strokeLinecap="round" fill="none" opacity="0.35" />

          {/* 3D Spikes (Spike 1: center 20, 24) */}
          <g>
            <ellipse cx="20" cy="36" rx="9" ry="3" fill="#020617" opacity="0.6" />
            <polygon points="11,35 20,12 20,35" fill="url(#metal-light)" />
            <polygon points="20,35 20,12 29,35" fill="url(#metal-dark)" />
          </g>

          {/* Spike 2: center 44, 20 */}
          <g>
            <ellipse cx="44" cy="34" rx="10" ry="3" fill="#020617" opacity="0.6" />
            <polygon points="34,33 44,7 44,33" fill="url(#metal-light)" />
            <polygon points="44,33 44,7 54,33" fill="url(#metal-dark)" />
          </g>

          {/* Spike 3: center 16, 48 */}
          <g>
            <ellipse cx="16" cy="58" rx="11" ry="3.5" fill="#020617" opacity="0.6" />
            <polygon points="5,57 16,30 16,57" fill="url(#metal-light)" />
            <polygon points="16,57 16,30 27,57" fill="url(#metal-dark)" />
          </g>

          {/* Spike 4: center 48, 44 */}
          <g>
            <ellipse cx="48" cy="54" rx="8" ry="2.5" fill="#020617" opacity="0.6" />
            <polygon points="40,53 48,31 48,53" fill="url(#metal-light)" />
            <polygon points="48,53 48,31 56,53" fill="url(#metal-dark)" />
          </g>
        </svg>
      )}
    </div>
  )
}
