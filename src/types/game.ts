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

// Salida de la transicion (Mealy): "P" pocion creada, "-" sin salida
export type TransitionOutput = "P" | "-"

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
