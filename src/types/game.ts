// Tipos compartidos del juego

export type Vector2D = {
  x: number
  y: number
}

export type Size = {
  width: number
  height: number
}

// Maquina de Mealy: ingredientes de entrada (Sprint 2: 5 ingredientes)
// A=Agua, B=Hierba, C=Hongo, D=Fuego, E=Cristal
export type Ingredient = "A" | "B" | "C" | "D" | "E"

// Estado del automata (lo maneja el backend, el frontend solo lo guarda).
// Conocidos: q0, qA, qD, qE, qAB, qAC, qDE, qEE
export type AutomatonState = string

// Pociones validas que puede producir la maquina
export type PotionId =
  | "P1"
  | "P2"
  | "P3"
  | "P4"
  | "P5"
  | "P6"
  | "P7"
  | "P8"
  | "P9"
  | "P10"

// Salida de la transicion (Mealy):
// "-" = aun mezclando (no hay producto), "P_basura" = mezcla fallida, "P1".."P10" = pocion creada
export type TransitionOutput = "-" | "P_basura" | PotionId

// Payload para /api/craft (debe coincidir con CraftRequest del backend)
export type CraftRequest = {
  estado_actual: AutomatonState
  ingrediente: Ingredient
}

// Respuesta del endpoint /api/craft (debe coincidir con CraftResponse del backend)
export type CraftResponse = {
  nuevo_estado: AutomatonState
  salida: TransitionOutput
  mensaje_ui: string
}

// Entidad interactuable en la escena
export type Interactable = {
  id: string
  position: Vector2D
  size: Size
  interactionRadius: number
}

// ---------------------------------------------------------------------------
// Tarea 3.3 - Sistema de combate (Máquina de Turing para sustracción propia)
// ---------------------------------------------------------------------------

// Payload para POST /api/combat/hit (cálculo de daño via Turing)
export type CombatRequest = {
  hp_actual: number      // La vida que tiene el objetivo ANTES del golpe
  dano_recibido: number  // Cuánto daño hace el proyectil
}

// Respuesta del endpoint /api/combat/hit
export type CombatResponse = {
  hp_resultante: number  // La vida exacta después del cálculo de Turing
  cinta_final: string    // (Debug) El estado de la cinta de la máquina
  mensaje_ui: string     // Mensaje para mostrar al jugador
}
