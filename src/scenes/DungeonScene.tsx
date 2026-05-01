import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  GiDoor,
  GiSkullCrossedBones,
  GiVortex,
  GiWoodenDoor,
  GiOpenTreasureChest,
} from "react-icons/gi"
import { Boss } from "../components/game/Boss"
import { MiniBoss } from "../components/game/MiniBoss"
import { Player } from "../components/game/Player"
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
import { useGameStore } from "../core/gameStore"
import { center, distance, intersectsAABB, isWithinRadius } from "../core/geometry"
import { useGameKeyboard } from "../hooks/useGameKeyboard"
import { useHotbarControls } from "../hooks/useHotbarControls"
import { usePlayerMovement } from "../hooks/usePlayerMovement"
import { bossAction, combatHit, generateDungeon } from "../services/api"
import { parseBossState } from "../types/boss"
import type { BossAction, BossState, BossStimulus } from "../types/boss"
import type { DungeonNode } from "../types/dungeon"
import type { Ingredient, Interactable, PotionId, Size, Vector2D } from "../types/game"

const WORLD_SIZE: Size = { width: 960, height: 600 }
const PLAYER_SIZE: Size = { width: 48, height: 48 }

function pseudoRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
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
const VISION_RADIUS = 130 // dentro de este radio -> estimulo "v" (vision)
const NOISE_RADIUS = 260 // dentro de este radio (y fuera del de vision) -> "r"
// Periodo del polling de la IA. No tiene sentido spamear /api/boss-action
// en cada frame; ~600ms da feedback rapido sin saturar el backend.
const BOSS_TICK_MS = 600
// Duracion del efecto de invisibilidad (ms). Se consume 1 unidad de P4.
const INVISIBILITY_MS = 6000
// Tarea 3.3: curación de las pociones P1 y P5.
const POTION_P1_HEAL = 25  // Poción Menor de Curación
const POTION_P5_HEAL = 50  // Poción de Curación Mayor
// Duraciones de los efectos de cada poción activa (ms).
const POTION_AIM_MS = 8000       // P2: Aceite de Puntería
const POTION_SPEED_MS = 6000     // P6: Velocidad de Movimiento
const POTION_MULTISHOT_MS = 8000 // P7: Suero de Disparo Múltiple
const POTION_REFLEX_MS = 8000    // P8: Tónico de Hiper-Reflejos
const POTION_SHIELD_MS = 5000    // P9: Escudo de Energía
const POTION_CADENCE_MS = 5000   // P10: Brebaje de Cadencia Extrema
// Factor de aumento de daño con Aceite de Puntería.
const AIM_POTION_DAMAGE_MULT = 1.5
// Multiplicador de velocidad de movimiento con P6.
export const SPEED_POTION_MULT = 1.6

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
const SHOOT_COOLDOWN_MS = 180
// Tarea 3.3: daño que inflige el proyectil del jugador al jefe.
const PLAYER_PROJECTILE_DAMAGE = 10
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
const BOSS_PATROL_SPEED = 1   // Estado A: paseo lento.
const BOSS_ATTACK_SPEED = 2   // Estado C: persecucion.
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
// Tarea 3.3: daño que infligen los proyectiles del jefe al jugador.
const BOSS_BASIC_PROJECTILE_DAMAGE = 15
const BOSS_HEAVY_PROJECTILE_DAMAGE = 25

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

type BossProjectileKind = "basic" | "heavy"

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
  const setIsGenerating = useGameStore((s) => s.setIsGeneratingDungeon)
  const setCurrentDungeon = useGameStore((s) => s.setCurrentDungeon)
  const pushNotification = useGameStore((s) => s.pushNotification)
  const collectDungeonIngredients = useGameStore((s) => s.collectDungeonIngredients)
  const claimSecretRoomPotions = useGameStore((s) => s.claimSecretRoomPotions)

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
        // Generar pociones aleatorias
        const allPotions: PotionId[] = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10"]
        const generatedPotions: PotionId[] = []
        // Entre 2 y 4 pociones para que se sienta recompensante
        const amount = Math.floor(Math.random() * 3) + 2
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
    // Forzamos el reset de salaActualId para que el useEffect de inicialización se ejecute
    setSalaActualId(null)
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
      // P3: Mezcla Volátil - ráfaga explosiva en 8 direcciones
      if (id === "P3") {
        const snap = useGameStore.getState()
        if (!bossPresent && !secretBossPresent) {
          pushNotification({ kind: "info", message: "No hay enemigos cerca para usar la Mezcla Volatil." })
          return
        }
        const pCenter = center(snap.playerPosition, PLAYER_SIZE)
        const dirs = [
          {dx:0,dy:-1},{dx:0,dy:1},{dx:1,dy:0},{dx:-1,dy:0},
          {dx:0.707,dy:-0.707},{dx:-0.707,dy:-0.707},{dx:0.707,dy:0.707},{dx:-0.707,dy:0.707}
        ]
        setProyectiles((prev) => [
          ...prev,
          ...dirs.map((d, i) => ({
            id: Date.now() + i,
            x: pCenter.x, y: pCenter.y,
            dx: d.dx, dy: d.dy,
            distanciaRecorrida: 0,
          }))
        ])
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
  // Tarea 3.1 - Sistema de combate del jugador (proyectiles).
  //
  // Diseno:
  //   - Estado LOCAL de la escena (no del store global) para evitar
  //     re-renders innecesarios en componentes ajenos al combate.
  //   - El disparo se habilita SOLO cuando el jugador esta en la sala
  //     del jefe (`bossPresent`), porque es donde hay un objetivo.
  //   - El movimiento de los proyectiles vive en un unico useEffect con
  //     requestAnimationFrame: actualiza posiciones, descarta los que
  //     se pasan de distancia/salen de pantalla y revisa AABB contra
  //     el jefe en cada frame.
  // -------------------------------------------------------------------------
  const [proyectiles, setProyectiles] = useState<ProjectileState[]>([])
  // Ref para acceder al array fresco dentro del rAF sin meter dependencia.
  const proyectilesRef = useRef<ProjectileState[]>([])
  proyectilesRef.current = proyectiles
  // Ref para el cooldown del disparo (no necesita causar re-render).
  const lastShotAtRef = useRef<number>(0)
  // Para que cada proyectil tenga un id unico aun si se disparan dos
  // en el mismo `Date.now()` (cooldown 180ms hace casi imposible la
  // colision, pero esto vuelve el id determinista y a prueba de balas).
  const projectileIdRef = useRef<number>(0)

  // Listener de la tecla J -> spawn de proyectil.
  // Solo activo en la sala del jefe o sala secreta con enemigo vivo.
  useEffect(() => {
    if ((!bossPresent && !secretBossPresent) || !movementEnabled) return

    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "j") return
      e.preventDefault()
      const now = performance.now()

      const snap = useGameStore.getState()
      const dir = snap.lastDirection
      // Defensa: si por algun motivo el vector es (0,0), no disparamos.
      if (dir.x === 0 && dir.y === 0) return

      // P8/P10: cooldown efectivo segun pociones activas.
      const effectiveCooldown = snap.isExtremeCadenceActive
        ? 0
        : snap.isHyperReflexesActive
          ? SHOOT_COOLDOWN_MS / 2
          : SHOOT_COOLDOWN_MS

      if (now - lastShotAtRef.current < effectiveCooldown) return
      lastShotAtRef.current = now

      const playerCenter = center(snap.playerPosition, PLAYER_SIZE)

      if (snap.isMultiShotActive) {
        // P7: triple disparo con ligera apertura angular.
        const angle = Math.atan2(dir.y, dir.x)
        const spread = Math.PI / 10 // 18 grados de apertura
        const offsets = [-spread, 0, spread]
        setProyectiles((prev) => [
          ...prev,
          ...offsets.map((off) => {
            projectileIdRef.current += 1
            return {
              id: projectileIdRef.current,
              x: playerCenter.x,
              y: playerCenter.y,
              dx: Math.cos(angle + off),
              dy: Math.sin(angle + off),
              distanciaRecorrida: 0,
            }
          }),
        ])
      } else {
        projectileIdRef.current += 1
        const nuevo: ProjectileState = {
          id: projectileIdRef.current,
          x: playerCenter.x,
          y: playerCenter.y,
          dx: dir.x,
          dy: dir.y,
          distanciaRecorrida: 0,
        }
        setProyectiles((prev) => [...prev, nuevo])
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [bossPresent, secretBossPresent, movementEnabled])

  // Game loop de los proyectiles + colisiones.
  // Se relanza cuando cambia la sala (bossPresent o bossPosition) y se
  // detiene si no hay proyectiles activos para no quemar CPU sin razon.
  useEffect(() => {
    if (!bossPresent && !secretBossPresent) {
      // Salimos de la sala: limpiamos los proyectiles vivos
      if (proyectilesRef.current.length > 0) setProyectiles([])
      return
    }

    let rafId = 0
    const tick = () => {
      const current = proyectilesRef.current
      if (current.length === 0) {
        // Nada que mover; pausa el loop hasta que vuelva a haber.
        rafId = requestAnimationFrame(tick)
        return
      }

      // Rect del jefe para la colision AABB. Tarea 3.2: el jefe se mueve,
      // asi que tomamos su posicion fresca via ref en cada frame en vez
      // de capturarla por closure (sino "fallariamos" a un fantasma).
      const bossPos = bossPositionRef.current
      const bossSize = BOSS_SIZE

      const next: ProjectileState[] = []
      for (const p of current) {
        const nx = p.x + p.dx * PROJECTILE_SPEED
        const ny = p.y + p.dy * PROJECTILE_SPEED
        const nDist = p.distanciaRecorrida + PROJECTILE_SPEED

        // Missing por distancia recorrida.
        if (nDist > PROJECTILE_MAX_DISTANCE) continue
        // Missing por salir del mundo (con un margen del tamano del proyectil).
        if (
          nx < -PROJECTILE_SIZE.width ||
          nx > WORLD_SIZE.width + PROJECTILE_SIZE.width ||
          ny < -PROJECTILE_SIZE.height ||
          ny > WORLD_SIZE.height + PROJECTILE_SIZE.height
        ) {
          continue
        }

        // Hit: AABB del proyectil vs AABB del objetivo activo.
        const projPos: Vector2D = {
          x: nx - PROJECTILE_SIZE.width / 2,
          y: ny - PROJECTILE_SIZE.height / 2,
        }
        
        let targetPos: Vector2D | null = null
        let targetSize = BOSS_SIZE
        if (bossPresent) targetPos = bossPositionRef.current
        else if (secretBossPresent) targetPos = miniBossPositionRef.current

        if (targetPos && intersectsAABB(projPos, PROJECTILE_SIZE, targetPos, targetSize)) {
          if (bossPresent) {
            // Fase 4 (3.2): Enviar estímulo "h" al Jefe
            const curState = useGameStore.getState().bossState
            if (curState !== "C") {
              void bossAction({ estado_actual: curState, estimulo: "h" }).then((res) => {
                const newState = parseBossState(res.nuevo_estado)
                if (newState) {
                  useGameStore.getState().setBossState(newState)
                  useGameStore.getState().setBossAction(res.accion as BossAction)
                }
              }).catch((err) => {
                console.error("[v0] Error en bossAction (near miss):", err)
              })
            }

            // Tarea 3.3: Calcular daño al jefe (P2: Aceite de Puntería aplica x1.5)
            const currentBossHp = useGameStore.getState().bossHp
            const bossLives = useGameStore.getState().bossLives
            if (bossLives > 0) {
              const aimMult = useGameStore.getState().isPotionAimActive ? AIM_POTION_DAMAGE_MULT : 1
              void combatHit({
                hp_actual: currentBossHp,
                dano_recibido: Math.round(PLAYER_PROJECTILE_DAMAGE * aimMult),
              }).then((res) => {
                useGameStore.getState().applyBossDamage(res.hp_resultante)
              }).catch((err) => {
                console.error("[v0] Error en combatHit (jefe):", err)
              })
            }
          } else if (secretBossPresent) {
            // Estímulo al MiniBoss
            const curState = useGameStore.getState().miniBossState
            if (curState !== "C") {
              void bossAction({ estado_actual: curState, estimulo: "h" }).then((res) => {
                const newState = parseBossState(res.nuevo_estado)
                if (newState) {
                  useGameStore.getState().setMiniBossState(newState)
                  useGameStore.getState().setMiniBossAction(res.accion as never)
                }
              }).catch((err) => {
                console.error("[v0] Error en bossAction (near miss MiniBoss):", err)
              })
            }

            // Calcular daño al mini jefe con API de Turing (P2: x1.5 si activo)
            const currentMiniBossHp = useGameStore.getState().miniBossHp
            if (currentMiniBossHp > 0 && currentNode) {
              const aimMult = useGameStore.getState().isPotionAimActive ? AIM_POTION_DAMAGE_MULT : 1
              void combatHit({
                hp_actual: currentMiniBossHp,
                dano_recibido: Math.round(PLAYER_PROJECTILE_DAMAGE * aimMult),
              }).then((res) => {
                useGameStore.getState().applyMiniBossDamage(currentNode.id, res.hp_resultante)
              }).catch((err) => {
                console.error("[v0] Error en combatHit (mini-jefe):", err)
              })
            }
          }
          continue
        }

        // Near miss check (Solo para el Jefe Principal de momento)
        let didTriggerNearMiss = p.triggeredNearMiss ?? false
        
        if (!didTriggerNearMiss && targetPos && bossPresent) {
          const bossCenter = center(bossPos, bossSize)
          const projCenter: Vector2D = { x: nx, y: ny }
          const distToBoss = distance(projCenter, bossCenter)
          // El umbral es el radio del jefe (mitad de la diagonal aprox) + margen.
          const bossRadius = Math.max(bossSize.width, bossSize.height) / 2
          const nearMissThreshold = bossRadius + BOSS_NEAR_MISS_THRESHOLD
          
          if (distToBoss < nearMissThreshold) {
            didTriggerNearMiss = true
            // El proyectil pasó muy cerca: despertar al jefe si no está en C.
            const curState = useGameStore.getState().bossState
            if (curState !== "C") {
              void bossAction({ estado_actual: curState, estimulo: "h" }).then((res) => {
                const newState = parseBossState(res.nuevo_estado)
                if (newState) {
                  useGameStore.getState().setBossState(newState)
                  useGameStore.getState().setBossAction(res.accion as BossAction)
                }
              }).catch((err) => {
                console.error("[v0] Error en bossAction (near miss):", err)
              })
            }
          }
        }

        next.push({ ...p, x: nx, y: ny, distanciaRecorrida: nDist, triggeredNearMiss: didTriggerNearMiss })
      }

      // Solo actualizamos el state si hubo cambio real (movimiento o muerte
      // de algun proyectil). Comparar por longitud + referencia es barato.
      if (
        next.length !== current.length ||
        next.some((p, i) => p !== current[i])
      ) {
        setProyectiles(next)
      }

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
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
        // -------- 1) Movimiento del jefe segun el estado de Moore --------
        if (state === "A") {
          // Patrullaje. Si no tenemos objetivo o estamos cerca de el,
          // elegimos un nuevo punto aleatorio dentro de un radio
          // BOSS_PATROL_RADIUS, clampeado a los bordes del mundo.
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
          // Buscar: el jefe se queda quieto. El feedback visual de que
          // "esta buscando" lo da el StateBadge del componente Boss
          // (icono "!" amarillo + animate-pulse).
          patrolTargetRef.current = null
        } else {
          // C - Atacar. Persigue al jugador hasta una distancia minima
          // para no encimarse encima de el.
          patrolTargetRef.current = null
          const playerCenter = center(snap.playerPosition, PLAYER_SIZE)
          const bossCenter = center(cur, BOSS_SIZE)
          const distToPlayer = distance(bossCenter, playerCenter)
          if (distToPlayer > BOSS_MIN_DISTANCE_TO_PLAYER) {
            // Convertimos el target del centro a la esquina sup-izq.
            const target: Vector2D = {
            x: playerCenter.x - BOSS_SIZE.width / 2,
            y: playerCenter.y - BOSS_SIZE.height / 2,
          }
          nextBossPos = stepTowards(cur, target, BOSS_ATTACK_SPEED * speedMult)
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

      // -------- 2) Ataque del jefe (solo en estado C) --------
      // Construimos el nuevo proyectil PERO no lo metemos al state aun:
      // lo pasamos a stepBossProjectiles para hacer un solo setState
      // por frame (sino la segunda escritura "pisa" la primera).
      const now = performance.now()
      if (
        state === "C" &&
        now - lastBossShotAtRef.current >= BOSS_SHOOT_COOLDOWN_MS
      ) {
        lastBossShotAtRef.current = now
        pendingSpawn = buildBossShotAtPlayer(furious, cur)
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
    // Si esta en Modo Furia, sortea 50/50 basico vs pesado.
    // No toca el state: solo devuelve el objeto (lo mete stepBossProjectiles).
    function buildBossShotAtPlayer(
      furious: boolean,
      bossC_topleft: Vector2D
    ): BossProjectileState | null {
      const playerC = center(
        useGameStore.getState().playerPosition,
        PLAYER_SIZE,
      )
      const bossC = center(bossC_topleft, BOSS_SIZE)
      const vx = playerC.x - bossC.x
      const vy = playerC.y - bossC.y
      const len = Math.sqrt(vx * vx + vy * vy)
      // Defensa: si por casualidad coinciden centros (no deberia, hay
      // BOSS_MIN_DISTANCE_TO_PLAYER), no disparamos.
      if (len === 0) return null

      // Modo Furia: 50% Basico, 50% Pesado. Math.random() <= 0.5 da el
      // mismo resultado que > 0.5 invertido (la spec dice "> 0.5: basico,
      // <= 0.5: pesado").
      const useHeavy = furious && Math.random() <= 0.5
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
    // expiran (con fragmentacion para los pesados) y revisa AABB contra
    // el jugador. Tambien adjunta `pendingSpawn` (proyectil recien creado
    // este frame) si lo hay. Solo escribe al state si hubo cambios.
    function stepBossProjectiles(
      playerPos: Vector2D,
      pendingSpawn: BossProjectileState | null,
    ) {
      const current = bossProyectilesRef.current
      if (current.length === 0 && !pendingSpawn) return

      // Esquirlas que generara la fragmentacion de los pesados expirados
      // este frame. Se acumulan y se concatenan al final.
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

        // Salida del mundo. Para los basicos -> simplemente desaparece.
        // Para los pesados -> tambien desaparece SIN fragmentar (porque
        // las esquirlas saldrian fuera de pantalla y serian invisibles).
        const fueraDelMundo =
          nx < -projSize.width ||
          nx > WORLD_SIZE.width + projSize.width ||
          ny < -projSize.height ||
          ny > WORLD_SIZE.height + projSize.height
        if (fueraDelMundo) continue

        // Expiracion por distancia recorrida.
        if (nDist > maxDist) {
          if (p.kind === "heavy") {
            // FRAGMENTACION: en las coordenadas exactas del proyectil
            // pesado expirado, instanciamos 8 proyectiles basicos.
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

        // Hit: AABB del proyectil vs AABB del jugador.
        const projPos: Vector2D = {
          x: nx - projSize.width / 2,
          y: ny - projSize.height / 2,
        }
        if (intersectsAABB(projPos, projSize, playerPos, PLAYER_SIZE)) {
          // P9: Escudo de Energía - invencibilidad temporal, ignora el impacto
          const isShielded = useGameStore.getState().isShieldActive
          if (isShielded) continue

          // Refactor 3.1: El daño al jugador también pasa por la Máquina de
          // Turing del backend para mantener consistencia académica.
          const damage = p.kind === "heavy"
            ? BOSS_HEAVY_PROJECTILE_DAMAGE
            : BOSS_BASIC_PROJECTILE_DAMAGE
          const currentPlayerHp = useGameStore.getState().playerHp
          // Solo procesamos si el jugador sigue vivo
          if (currentPlayerHp > 0) {
            void combatHit({
              hp_actual: currentPlayerHp,
              dano_recibido: damage,
            }).then((res) => {
              useGameStore.getState().setPlayerHp(res.hp_resultante)
              useGameStore.getState().setPlayerHealthFlash(true)
              // Game Over: si hp_resultante === 0, el jugador murió
              if (res.hp_resultante === 0) {
                // La pantalla de muerte maneja el retorno.
                // Limpiamos la IA del jefe para evitar daño residual mientras se ve la pantalla.
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

      // Concatenamos: proyectiles que sobreviven + esquirlas generadas
      // por pesados expirados + el spawn de este frame (si hubo disparo).
      const result: BossProjectileState[] = next
      if (esquirlasGeneradas.length > 0) result.push(...esquirlasGeneradas)
      if (pendingSpawn) result.push(pendingSpawn)

      // Solo actualizamos si cambio algo (longitud o referencia de los
      // elementos). Evita re-renders en frames donde nada se movio
      // (por ejemplo, cuando el array esta vacio).
      if (
        result.length !== current.length ||
        result.some((p, i) => p !== current[i])
      ) {
        setBossProyectiles(result)
      }
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
    // bossPresent / secretBossPresent reinicia todo el sistema.
    // NO ponemos bossState aqui: lo leemos via getState() en cada frame.
  }, [bossPresent, secretBossPresent])

  // ---------------------------------------------------------------------------
  // Debug toggle del Modo Furia.
  // Tarea 3.2 expone esta funcion para que el dev de Tarea 3.3 (HP) la
  // pueda invocar al perder la primera barra de vida del jefe. Se llama
  // tambien desde el boton "Activar Furia" del panel de la sala del jefe.
  // ---------------------------------------------------------------------------
  const isBossFurious = useGameStore((s) => s.isBossFurious)
  const activarModoFuria = useGameStore((s) => s.activarModoFuria)
  const desactivarModoFuria = useGameStore((s) => s.desactivarModoFuria)

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
        {bossPresent && bossLives > 0 && (
          <Boss position={bossPosition} size={BOSS_SIZE} state={bossState} />
        )}

        {/* Mini-Boss (solo en salas secretas) */}
        {secretBossPresent && miniBossHp > 0 && (
          <MiniBoss position={miniBossPosition} size={BOSS_SIZE} state={miniBossState} />
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
            variant={p.kind === "heavy" ? "boss-heavy" : "boss-basic"}
          />
        ))}

        {/* Proyectiles del jugador (Tarea 3.1).
            Se renderizan SIEMPRE que haya entradas vivas en el array.
            La logica del game loop ya se asegura de vaciar el array al
            salir de la sala del jefe. */}
        {proyectiles.map((p) => (
          <Projectile
            key={p.id}
            x={p.x}
            y={p.y}
            size={PROJECTILE_SIZE.width}
            variant="player"
          />
        ))}

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

        {/* Jugador */}
        <Player position={playerPosition} size={PLAYER_SIZE} />

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
          <div className={`pointer-events-none absolute left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-1 ${
            bossPresent ? "top-16" : "top-4"
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
              className={`rounded-md border px-3 py-1.5 text-center shadow backdrop-blur ${
                isBossFurious
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
              {/* Tarea 3.2 - Boton DEBUG: activa/desactiva el Modo Furia
                  manualmente porque la Tarea 3.3 (HP del jefe) aun no
                  esta implementada. Cuando exista el HP, se llamara a
                  `useGameStore.getState().activarModoFuria()` desde el
                  evento "Vida 1 == 0" en lugar de este boton. */}
              <button
                type="button"
                onClick={() =>
                  isBossFurious ? desactivarModoFuria() : activarModoFuria()
                }
                className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold hover:opacity-90 ${
                  isBossFurious
                    ? "bg-purple-700 text-purple-100"
                    : "bg-red-700 text-red-100"
                }`}
                aria-pressed={isBossFurious}
                title="Debug: simula que el jefe perdio la primera barra de vida"
              >
                {isBossFurious ? "Desactivar Furia" : "Activar Furia (debug)"}
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
