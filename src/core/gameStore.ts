import { create } from "zustand"
import type {
  AutomatonState,
  Ingredient,
  PotionId,
  TransitionOutput,
  Vector2D,
} from "../types/game"

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
}))
