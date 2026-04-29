// Tipos del Sprint 4: IA del Jefe (Maquina de Moore).
// Q (estados) = A | B | C
// Sigma (entrada) = r (ruido) | v (vision) | p (perdida de vision)
// Gamma (salida) = "Patrullar" | "Buscar" | "Atacar"
// Las cadenas se mantienen como string en la respuesta para tolerar
// que el backend evolucione, pero internamente trabajamos con uniones.

export type BossState = "A" | "B" | "C"
export type BossStimulus = "r" | "v" | "p"
export type BossAction = "Patrullar" | "Buscar" | "Atacar"

// Payload que enviamos al endpoint POST /api/boss-action.
export type BossRequest = {
  estado_actual: BossState
  estimulo: BossStimulus
}

// Respuesta del backend. nuevo_estado y accion vienen como string en la
// especificacion oficial; los validamos al consumir.
export type BossResponse = {
  nuevo_estado: string
  accion: string
  mensaje_ui: string
}

// Helper: convierte un string del backend a un BossState valido o null.
export function parseBossState(value: string): BossState | null {
  return value === "A" || value === "B" || value === "C" ? value : null
}
