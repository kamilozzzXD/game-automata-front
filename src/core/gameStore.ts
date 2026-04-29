import { create } from "zustand"
import type {
  AutomatonState,
  Ingredient,
  PotionId,
  TransitionOutput,
  Vector2D,
} from "../types/game"
import type { DungeonResponse } from "../types/dungeon"
import type { BossAction, BossState } from "../types/boss"

// Sprint 4 - Barra de acceso rapido (hotbar vertical).
// Tenemos 10 slots fijos, uno por tipo de pocion (P1..P10).
// Asi el jugador siempre ve "donde" estaria cada pocion aunque no la tenga.
export const HOTBAR_SLOTS: PotionId[] = [
  "P1",
  "P2",
  "P3",
  "P4",
  "P5",
  "P6",
  "P7",
  "P8",
  "P9",
  "P10",
]

// Sistema de notificaciones flotantes (potion crafted, error, etc.)
export type GameNotification = {
  id: number
  kind: "success" | "error" | "info"
  message: string
}

// Inventario por tipo de pocion: P1..P10 -> cantidad
export type Inventory = Partial<Record<PotionId, number>>

type GameStore = {
  // ----- Mundo / Jugador -----
  playerPosition: Vector2D
  setPlayerPosition: (pos: Vector2D) => void

  // ----- UI / Escena -----
  isCraftingOpen: boolean
  openCrafting: () => void
  closeCrafting: () => void

  // ----- Estado de la Maquina de Mealy (Sprint 2) -----
  // El backend ahora se auto-resetea: cualquier mezcla fallida regresa a q0.
  // El frontend solo refleja el estado y la ultima salida para animaciones.
  automatonState: AutomatonState
  ingredientHistory: Ingredient[]
  lastOutput: TransitionOutput
  isCrafting: boolean
  setAutomatonState: (s: AutomatonState) => void
  pushIngredient: (i: Ingredient) => void
  setLastOutput: (o: TransitionOutput) => void
  setIsCrafting: (b: boolean) => void
  // Solo limpia la historia visual del trail (no llama al backend).
  // Se usa internamente cuando el backend devuelve nuevo_estado === "q0".
  clearTrail: () => void

  // ----- Inventario (pociones obtenidas, por tipo) -----
  inventory: Inventory
  trashCount: number
  addPotion: (id: PotionId) => void
  addTrash: () => void

  // ----- Notificaciones -----
  notifications: GameNotification[]
  pushNotification: (n: Omit<GameNotification, "id">) => void
  removeNotification: (id: number) => void

  // ----- Escena actual (Sprint 3.1) -----
  // El juego ahora tiene varias escenas; el portal cambia de bosque a mazmorra.
  currentScene: "forest" | "dungeon"
  setCurrentScene: (s: "forest" | "dungeon") => void

  // ----- Mazmorra (Sprint 3 - GLC) -----
  // Toda la mazmorra llega de golpe en una sola peticion.
  isGeneratingDungeon: boolean
  currentDungeon: DungeonResponse | null
  setIsGeneratingDungeon: (b: boolean) => void
  setCurrentDungeon: (d: DungeonResponse | null) => void

  // ----- Hotbar / Pociones activas (Sprint 4 - Tarea 1 y 2) -----
  // Indice 0..HOTBAR_SLOTS.length-1 del slot seleccionado.
  selectedHotbarIndex: number
  setSelectedHotbarIndex: (i: number) => void
  // Mueve la seleccion +1 / -1 ciclicamente por la barra (sin importar si
  // el slot tiene o no pocion, asi el jugador percibe el desplazamiento).
  cycleHotbar: (direction: 1 | -1) => void
  // Consume 1 unidad de la pocion seleccionada. Devuelve la PotionId
  // consumida o null si el slot estaba vacio. La logica de efecto la
  // dispara la escena (no el store) para no acoplar UI con backend.
  consumeSelectedPotion: () => PotionId | null

  // Efecto activo: invisibilidad por Pocion P4. Solo guardamos el flag;
  // la duracion la maneja la escena con un setTimeout.
  isPlayerInvisible: boolean
  setPlayerInvisible: (b: boolean) => void

  // ----- Jefe / IA (Sprint 4 - Maquina de Moore) -----
  // Estado matematico actual del automata del jefe. Reseteamos a "A"
  // cada vez que el jugador entra a la sala del jefe.
  bossState: BossState
  setBossState: (s: BossState) => void
  // Ultima accion narrada por el backend (Patrullar/Buscar/Atacar).
  bossAction: BossAction
  setBossAction: (a: BossAction) => void
  // Lock para evitar que se solapen peticiones a /api/boss-action.
  isBossThinking: boolean
  setIsBossThinking: (b: boolean) => void
  // Reset completo de la IA del jefe (al entrar a la guarida).
  resetBoss: () => void

  // ----- Inventario completo (Sprint 5 - Tarea 1.B) -----
  // Modal independiente que se abre con la tecla `I`.
  isInventoryOpen: boolean
  openInventory: () => void
  closeInventory: () => void

  // ----- Combate (Sprint 5 - Tarea 2 y siguientes) -----
  // HP del jugador. La barra es "normal" (cap 100) y se puede recuperar
  // bebiendo pociones de cura. La logica de daño en el backend usa
  // sustraccion propia con Maquina de Turing, pero aqui solo guardamos
  // el resultado.
  playerHP: number
  playerMaxHP: number
  setPlayerHP: (hp: number) => void
  // Sumar HP por curacion (clamp en max).
  healPlayer: (amount: number) => void
  resetPlayerHP: () => void

  // HP del jefe + vidas extra. Cuando la barra principal llega a 0,
  // restamos un cuadrito de `bossExtraLives`, reseteamos `bossHP`
  // a `bossMaxHP` y disparamos la fase "furious" si aplica.
  bossHP: number
  bossMaxHP: number
  bossExtraLives: number // empieza en 2 cuadritos
  bossPhase: "normal" | "furious"
  setBossHP: (hp: number) => void
  setBossExtraLives: (n: number) => void
  setBossPhase: (p: "normal" | "furious") => void
  resetBossCombat: () => void

  // Flash de impacto: cuando el jugador / jefe recibe daño, parpadeamos
  // su barra durante un instante. Guardamos el timestamp del ultimo hit.
  playerHitFlashAt: number
  bossHitFlashAt: number
  flashPlayerHit: () => void
  flashBossHit: () => void

  // Direccion de mira del jugador. Es un vector unitario (o cero).
  // La actualiza usePlayerMovement cada vez que cambia el input WASD.
  // Usado para apuntar proyectiles con tecla `J` y para dibujar el
  // arco/flecha exterior del Player.
  playerFacing: Vector2D
  isPlayerMoving: boolean
  setPlayerFacing: (v: Vector2D) => void
  setIsPlayerMoving: (b: boolean) => void

  // Game Over / Victoria (vuelve al bosque tras notificar).
  gameOutcome: "playing" | "victory" | "defeat"
  setGameOutcome: (s: "playing" | "victory" | "defeat") => void
}

let notificationCounter = 0

export const useGameStore = create<GameStore>((set) => ({
  // Mundo
  playerPosition: { x: 400, y: 300 },
  setPlayerPosition: (pos) => set({ playerPosition: pos }),

  // UI
  isCraftingOpen: false,
  openCrafting: () => set({ isCraftingOpen: true }),
  closeCrafting: () => set({ isCraftingOpen: false }),

  // Maquina de Mealy
  automatonState: "q0",
  ingredientHistory: [],
  lastOutput: "-",
  isCrafting: false,
  setAutomatonState: (s) => set({ automatonState: s }),
  pushIngredient: (i) =>
    set((state) => ({ ingredientHistory: [...state.ingredientHistory, i] })),
  setLastOutput: (o) => set({ lastOutput: o }),
  setIsCrafting: (b) => set({ isCrafting: b }),
  clearTrail: () => set({ ingredientHistory: [] }),

  // Inventario
  inventory: {},
  trashCount: 0,
  addPotion: (id) =>
    set((state) => ({
      inventory: { ...state.inventory, [id]: (state.inventory[id] ?? 0) + 1 },
    })),
  addTrash: () => set((state) => ({ trashCount: state.trashCount + 1 })),

  // Notificaciones
  notifications: [],
  pushNotification: (n) =>
    set((state) => ({
      notifications: [...state.notifications, { ...n, id: ++notificationCounter }],
    })),
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((x) => x.id !== id),
    })),

  // Escena
  currentScene: "forest",
  setCurrentScene: (s) => set({ currentScene: s }),

  // Mazmorra
  isGeneratingDungeon: false,
  currentDungeon: null,
  setIsGeneratingDungeon: (b) => set({ isGeneratingDungeon: b }),
  setCurrentDungeon: (d) => set({ currentDungeon: d }),

  // Hotbar / pociones activas
  selectedHotbarIndex: 0,
  setSelectedHotbarIndex: (i) =>
    set({
      // Clamp por seguridad si llega un indice fuera de rango.
      selectedHotbarIndex:
        ((i % HOTBAR_SLOTS.length) + HOTBAR_SLOTS.length) % HOTBAR_SLOTS.length,
    }),
  cycleHotbar: (direction) =>
    set((state) => {
      const next =
        ((state.selectedHotbarIndex + direction) % HOTBAR_SLOTS.length +
          HOTBAR_SLOTS.length) %
        HOTBAR_SLOTS.length
      return { selectedHotbarIndex: next }
    }),
  consumeSelectedPotion: () => {
    let consumed: PotionId | null = null
    set((state) => {
      const id = HOTBAR_SLOTS[state.selectedHotbarIndex]
      const count = state.inventory[id] ?? 0
      if (count <= 0) return {}
      consumed = id
      const nextCount = count - 1
      const nextInv: Inventory = { ...state.inventory }
      if (nextCount <= 0) delete nextInv[id]
      else nextInv[id] = nextCount
      return { inventory: nextInv }
    })
    return consumed
  },

  // Invisibilidad
  isPlayerInvisible: false,
  setPlayerInvisible: (b) => set({ isPlayerInvisible: b }),

  // IA del jefe
  bossState: "A",
  setBossState: (s) => set({ bossState: s }),
  bossAction: "Patrullar",
  setBossAction: (a) => set({ bossAction: a }),
  isBossThinking: false,
  setIsBossThinking: (b) => set({ isBossThinking: b }),
  resetBoss: () =>
    set({ bossState: "A", bossAction: "Patrullar", isBossThinking: false }),

  // Inventario modal
  isInventoryOpen: false,
  openInventory: () => set({ isInventoryOpen: true }),
  closeInventory: () => set({ isInventoryOpen: false }),

  // Combate (jugador)
  playerHP: 100,
  playerMaxHP: 100,
  setPlayerHP: (hp) => set((s) => ({ playerHP: Math.max(0, Math.min(s.playerMaxHP, hp)) })),
  healPlayer: (amount) =>
    set((s) => ({
      playerHP: Math.min(s.playerMaxHP, s.playerHP + Math.max(0, amount)),
    })),
  resetPlayerHP: () => set((s) => ({ playerHP: s.playerMaxHP })),

  // Combate (jefe)
  bossHP: 100,
  bossMaxHP: 100,
  bossExtraLives: 2, // inicia con 2 cuadritos -> total 3 barras
  bossPhase: "normal",
  setBossHP: (hp) => set({ bossHP: Math.max(0, Math.min(100, hp)) }),
  setBossExtraLives: (n) => set({ bossExtraLives: Math.max(0, n) }),
  setBossPhase: (p) => set({ bossPhase: p }),
  resetBossCombat: () =>
    set({ bossHP: 100, bossExtraLives: 2, bossPhase: "normal" }),

  // Flash de impacto (timestamp en ms; 0 = sin flash activo)
  playerHitFlashAt: 0,
  bossHitFlashAt: 0,
  flashPlayerHit: () => set({ playerHitFlashAt: Date.now() }),
  flashBossHit: () => set({ bossHitFlashAt: Date.now() }),

  // Direccion del jugador (Sprint 5 - Tarea 3.B)
  playerFacing: { x: 0, y: 1 }, // por defecto mira "abajo"
  isPlayerMoving: false,
  setPlayerFacing: (v) => set({ playerFacing: v }),
  setIsPlayerMoving: (b) => set({ isPlayerMoving: b }),

  // Game outcome
  gameOutcome: "playing",
  setGameOutcome: (s) => set({ gameOutcome: s }),
}))
