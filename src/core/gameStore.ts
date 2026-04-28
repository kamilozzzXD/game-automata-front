import { create } from "zustand"
import type { AutomatonState, Ingredient, TransitionOutput, Vector2D } from "../types/game"

// Sistema de notificaciones flotantes (potion crafted, error, etc.)
export type GameNotification = {
  id: number
  kind: "success" | "error" | "info"
  message: string
}

type GameStore = {
  // ----- Mundo / Jugador -----
  playerPosition: Vector2D
  setPlayerPosition: (pos: Vector2D) => void

  // ----- UI / Escena -----
  isCraftingOpen: boolean
  openCrafting: () => void
  closeCrafting: () => void

  // ----- Estado de la Maquina de Mealy (Sprint 1: Alquimia) -----
  automatonState: AutomatonState
  ingredientHistory: Ingredient[]
  lastOutput: TransitionOutput
  isCrafting: boolean
  setAutomatonState: (s: AutomatonState) => void
  pushIngredient: (i: Ingredient) => void
  setLastOutput: (o: TransitionOutput) => void
  setIsCrafting: (b: boolean) => void
  resetCauldron: () => void

  // ----- Inventario (pociones obtenidas) -----
  potionsCrafted: number
  addPotion: () => void

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
  resetCauldron: () =>
    set({
      automatonState: "q0",
      ingredientHistory: [],
      lastOutput: "-",
      isCrafting: false,
    }),

  // Inventario
  potionsCrafted: 0,
  addPotion: () => set((state) => ({ potionsCrafted: state.potionsCrafted + 1 })),

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
