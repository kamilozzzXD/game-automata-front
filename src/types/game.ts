// Tipos compartidos del juego

export type Vector2D = {
  x: number
  y: number
}

export type Size = {
  width: number
  height: number
}

// Maquina de Mealy: ingredientes de entrada
export type Ingredient = "A" | "B" | "C"

// Estado del automata (lo maneja el backend, el frontend solo lo guarda)
export type AutomatonState = string // "q0", "q1", "q_error", etc.

// Salida de la transicion
export type TransitionOutput = "P" | "F" | null // Pocion, Fallo, o nada

// Respuesta del endpoint /api/craft
export type CraftResponse = {
  estado: AutomatonState
  salida: TransitionOutput
}

// Payload para /api/craft
export type CraftRequest = {
  estado: AutomatonState
  ingrediente: Ingredient
}

// Entidad interactuable en la escena
export type Interactable = {
  id: string
  position: Vector2D
  size: Size
  interactionRadius: number
}
