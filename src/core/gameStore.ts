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
import { INITIAL_POTIONS } from "./diccionario"

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

  // ----- Orientacion del jugador (Tarea 3.1) -----
  // Ultimo vector de direccion conocido. Se actualiza mientras el jugador
  // se mueve y se CONSERVA cuando suelta las teclas (asi sabemos hacia
  // donde disparar si esta quieto). Default: mirando hacia abajo.
  lastDirection: Vector2D
  setLastDirection: (v: Vector2D) => void
  // Flag que indica si el jugador esta presionando teclas de movimiento.
  // Lo usa el indicador visual de apuntado para mostrarse/ocultarse.
  isPlayerMoving: boolean
  setIsPlayerMoving: (b: boolean) => void

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
  // Inventario de ingredientes recolectados en la mazmorra
  ingredientInventory: Partial<Record<Ingredient, number>>
  trashCount: number
  addPotion: (id: PotionId) => void
  addTrash: () => void
  // Acciones para ingredientes y secretos
  collectDungeonIngredients: (nodeId: number, collected: Ingredient[], remaining: (Ingredient | null)[]) => void
  claimSecretRoomPotions: (nodeId: number, potions: PotionId[]) => void
  consumeIngredient: (ingredient: Ingredient) => boolean
  addIngredient: (ingredient: Ingredient) => void

  // ----- Notificaciones -----
  notifications: GameNotification[]
  pushNotification: (n: Omit<GameNotification, "id">) => void
  removeNotification: (id: number) => void
  clearNotifications: () => void

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

  // ----- Mini-Boss / IA (Salas Secretas) -----
  miniBossState: BossState
  setMiniBossState: (s: BossState) => void
  miniBossAction: BossAction
  setMiniBossAction: (a: BossAction) => void

  // ----- Modo Furia del Jefe (Tarea 3.2 - Fase 2) -----
  //
  // Flag global. Cuando es true, la logica de disparo del jefe en estado C
  // (Atacar) cambia: cada vez que termina su cooldown lanza un dado al 50%
  // y elige entre Ataque Basico o Ataque Pesado (proyectil grande, lento,
  // que se fragmenta en 8 direcciones al expirar).
  //
  // ESTE FLAG ES EL "ENGANCHE" PARA LA TAREA 3.3 (HP y Maquinas de Turing).
  // Cuando el sistema de vida del jefe (Tarea 3.3) detecte que se rompio
  // la PRIMERA barra (Vida 1 == 0), debe llamar a:
  //
  //     useGameStore.getState().activarModoFuria()
  //
  // Eso es todo. El bucle del jefe en DungeonScene ya esta suscrito a
  // este flag y empezara a usar Ataques Pesados aleatorios automaticamente.
  isBossFurious: boolean
  // Activa el Modo Furia (idempotente: llamar dos veces no rompe nada).
  // Usar desde la Tarea 3.3 al perder la primera barra de vida del jefe.
  activarModoFuria: () => void
  // Apaga el modo (lo usamos al resetear el jefe / cambiar de mazmorra
  // y en el boton de debug).
  desactivarModoFuria: () => void

  // ----- Tarea 3.3 - Sistema de Vida (Máquina de Turing) -----
  //
  // Vida del Jugador: una sola barra de 100 HP.
  // Las pociones P1 (Menor de Curación) y P5 (Curación Mayor) la restauran.
  playerHp: number
  setPlayerHp: (hp: number) => void
  // Suma HP acotada: Math.min(playerHp + curacion, 100).
  healPlayer: (amount: number) => void
  // Resta HP (llamada cuando un proyectil del jefe impacta).
  damagePlayer: (amount: number) => void

  // Vida del Jefe: 2 barras de 100 HP cada una.
  // bossHp = HP de la barra actual (0-100).
  // bossLives = número de barras restantes (2 = intacto, 1 = fase 2, 0 = muerto).
  bossHp: number
  bossLives: number
  setBossHp: (hp: number) => void
  setBossLives: (lives: number) => void
  // Llamada cuando el proyectil del jugador impacta y la API responde.
  // Maneja la lógica de cambio de fase y activación del Modo Furia.
  applyBossDamage: (newHp: number) => void
  // Reset completo de la vida del jefe (al entrar a una sala del jefe nueva).
  resetBossHealth: () => void

  // Vida del Mini-Boss (Sala Secreta): una sola barra de 50 HP.
  miniBossHp: number
  applyMiniBossDamage: (nodeId: number, newHp: number) => void
  resetMiniBoss: () => void

  // Flag para feedback visual: hace parpadear la barra del jefe brevemente.
  bossHealthFlash: boolean
  setBossHealthFlash: (b: boolean) => void
  // Flag para feedback visual: hace parpadear la barra del jugador brevemente.
  playerHealthFlash: boolean
  setPlayerHealthFlash: (b: boolean) => void

  // ----- Efectos activos de pociones -----
  isPotionAimActive: boolean       // P2: daño x1.5
  setIsPotionAimActive: (b: boolean) => void
  isSpeedActive: boolean           // P6: velocidad x1.6
  setIsSpeedActive: (b: boolean) => void
  isMultiShotActive: boolean       // P7: triple disparo
  setIsMultiShotActive: (b: boolean) => void
  isHyperReflexesActive: boolean   // P8: cooldown de disparo /2
  setIsHyperReflexesActive: (b: boolean) => void
  isShieldActive: boolean          // P9: invencibilidad temporal
  setIsShieldActive: (b: boolean) => void
  isExtremeCadenceActive: boolean  // P10: cooldown disparo ~0
  setIsExtremeCadenceActive: (b: boolean) => void
  isVictoryAchieved: boolean
  setVictoryAchieved: (b: boolean) => void
}

let notificationCounter = 0

export const useGameStore = create<GameStore>((set) => ({
  // Mundo
  playerPosition: { x: 400, y: 300 },
  setPlayerPosition: (pos) => set({ playerPosition: pos }),

  // Orientacion (Tarea 3.1)
  lastDirection: { x: 0, y: 1 },
  setLastDirection: (v) => set({ lastDirection: v }),
  isPlayerMoving: false,
  setIsPlayerMoving: (b) => set({ isPlayerMoving: b }),

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

  // Inventario (Balance inicial cargado desde diccionario.tsx)
  inventory: { ...INITIAL_POTIONS },
  ingredientInventory: {},
  trashCount: 0,
  addPotion: (id) =>
    set((state) => ({
      inventory: { ...state.inventory, [id]: (state.inventory[id] ?? 0) + 1 },
    })),
  addTrash: () => set((state) => ({ trashCount: state.trashCount + 1 })),
  collectDungeonIngredients: (nodeId, collected, remaining) =>
    set((state) => {
      if (!state.currentDungeon) return {}
      const newAst = state.currentDungeon.estructura_ast.map((n) =>
        n.id === nodeId ? { ...n, ingredientes: remaining } : n
      )
      
      const nextInv = { ...state.ingredientInventory }
      for (const ing of collected) {
        nextInv[ing] = (nextInv[ing] ?? 0) + 1
      }
      
      return {
        ingredientInventory: nextInv,
        currentDungeon: {
          ...state.currentDungeon,
          estructura_ast: newAst,
        },
      }
    }),
  claimSecretRoomPotions: (nodeId, potions) =>
    set((state) => {
      if (!state.currentDungeon) return {}
      const newAst = state.currentDungeon.estructura_ast.map((n) =>
        n.id === nodeId ? { ...n, pociones_reclamadas: true } : n
      )
      const nextInv = { ...state.inventory }
      for (const p of potions) {
        nextInv[p] = (nextInv[p] ?? 0) + 1
      }
      return {
        inventory: nextInv,
        currentDungeon: {
          ...state.currentDungeon,
          estructura_ast: newAst,
        },
      }
    }),
  consumeIngredient: (ingredient) => {
    let success = false
    set((state) => {
      const count = state.ingredientInventory[ingredient] ?? 0
      if (count > 0) {
        success = true
        return {
          ingredientInventory: {
            ...state.ingredientInventory,
            [ingredient]: count - 1,
          },
        }
      }
      return {}
    })
    return success
  },
  addIngredient: (ingredient) =>
    set((state) => ({
      ingredientInventory: {
        ...state.ingredientInventory,
        [ingredient]: (state.ingredientInventory[ingredient] ?? 0) + 1,
      },
    })),

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
  clearNotifications: () =>
    set({ notifications: [] }),

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

  // Mini-Boss State
  miniBossState: "A",
  setMiniBossState: (s) => set({ miniBossState: s }),
  miniBossAction: "Patrullar",
  setMiniBossAction: (a) => set({ miniBossAction: a }),
  isBossThinking: false,
  setIsBossThinking: (b) => set({ isBossThinking: b }),
  resetBoss: () =>
    set({
      bossState: "A",
      bossAction: "Patrullar",
      isBossThinking: false,
      // Al entrar a una sala del jefe nueva, asumimos Vida 1 intacta:
      // por lo tanto el modo furia debe arrancar apagado.
      isBossFurious: false,
      // Tarea 3.3: resetear también la vida del jefe
      bossHp: 100,
      bossLives: 2,
      bossHealthFlash: false,
      isVictoryAchieved: false,
    }),

  // Modo Furia (Tarea 3.2 - handoff a Tarea 3.3).
  isBossFurious: false,
  activarModoFuria: () => set({ isBossFurious: true }),
  desactivarModoFuria: () => set({ isBossFurious: false }),

  // ----- Tarea 3.3 - Sistema de Vida (Máquina de Turing) -----
  // Jugador
  playerHp: 100,
  setPlayerHp: (hp) => set({ playerHp: Math.max(0, Math.min(100, hp)) }),
  healPlayer: (amount) =>
    set((state) => ({
      playerHp: Math.min(state.playerHp + amount, 100),
    })),
  damagePlayer: (amount) =>
    set((state) => ({
      playerHp: Math.max(state.playerHp - amount, 0),
    })),

  // Jefe
  bossHp: 100,
  bossLives: 2,
  setBossHp: (hp) => set({ bossHp: Math.max(0, Math.min(100, hp)) }),
  setBossLives: (lives) => set({ bossLives: Math.max(0, Math.min(2, lives)) }),
  applyBossDamage: (newHp) =>
    set((state) => {
      // Si la barra actual llega a 0 y quedan 2 vidas (primera fase)
      if (newHp === 0 && state.bossLives === 2) {
        // Cambio de fase: activar Modo Furia y rellenar barra
        return {
          bossHp: 100,
          bossLives: 1,
          isBossFurious: true,
          bossHealthFlash: true,
        }
      }
      // Si la barra actual llega a 0 y solo queda 1 vida -> jefe muere
      if (newHp === 0 && state.bossLives === 1) {
        return {
          bossHp: 0,
          bossLives: 0,
          bossHealthFlash: true,
        }
      }
      // Daño normal (sin matar la barra)
      return {
        bossHp: newHp,
        bossHealthFlash: true,
      }
    }),
  resetBossHealth: () =>
    set({
      bossHp: 100,
      bossLives: 2,
      bossHealthFlash: false,
    }),

  miniBossHp: 50,
  applyMiniBossDamage: (nodeId, newHp) =>
    set((state) => {
      // Si el HP llega a 0, actualizar el nodo y marcarlo como derrotado
      if (newHp === 0 && state.currentDungeon) {
        const newAst = state.currentDungeon.estructura_ast.map((n) =>
          n.id === nodeId ? { ...n, enemigo_derrotado: true } : n
        )
        return {
          miniBossHp: 0,
          currentDungeon: {
            ...state.currentDungeon,
            estructura_ast: newAst,
          },
          bossHealthFlash: true,
        }
      }
      return { miniBossHp: newHp, bossHealthFlash: true }
    }),
  resetMiniBoss: () =>
    set({
      miniBossState: "A",
      miniBossAction: "Patrullar",
      miniBossHp: 50,
    }),

  // Feedback visual
  bossHealthFlash: false,
  setBossHealthFlash: (b) => set({ bossHealthFlash: b }),
  playerHealthFlash: false,
  setPlayerHealthFlash: (b) => set({ playerHealthFlash: b }),

  // Efectos activos de pociones
  isPotionAimActive: false,
  setIsPotionAimActive: (b) => set({ isPotionAimActive: b }),
  isSpeedActive: false,
  setIsSpeedActive: (b) => set({ isSpeedActive: b }),
  isMultiShotActive: false,
  setIsMultiShotActive: (b) => set({ isMultiShotActive: b }),
  isHyperReflexesActive: false,
  setIsHyperReflexesActive: (b) => set({ isHyperReflexesActive: b }),
  isShieldActive: false,
  setIsShieldActive: (b) => set({ isShieldActive: b }),
  isExtremeCadenceActive: false,
  setIsExtremeCadenceActive: (b) => set({ isExtremeCadenceActive: b }),
  isVictoryAchieved: false,
  setVictoryAchieved: (b) => set({ isVictoryAchieved: b }),
}))
