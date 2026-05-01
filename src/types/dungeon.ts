// Tipos para la Fase 2: Generador de Mazmorras (Gramatica Libre de Contexto).
// Deben coincidir 1:1 con DungeonNode / DungeonResponse del backend (FastAPI/Pydantic).

export type DungeonNodeType = "inicio" | "pasillo" | "sala" | "jefe"

export type DungeonNode = {
  id: number
  tipo: DungeonNodeType
  // IDs de los nodos hijos en el AST.
  conexiones: number[]
  // Ingrediente depositado en la sala (si lo hay)
  ingredientes: ("A" | "B" | "C" | "D" | "E" | null)[]
  // Flag para indicar si el cofre de la sala secreta ya fue reclamado
  pociones_reclamadas?: boolean
  // Flag para indicar si el mini-boss de la sala secreta fue derrotado
  enemigo_derrotado?: boolean
}

export type DungeonResponse = {
  // Cadena plana derivada por la gramatica (util para debug, ej: "inicio pasillo sala pasillo jefe").
  cadena_plana: string
  // Lista plana de nodos del AST que el frontend debe reconstruir como arbol.
  estructura_ast: DungeonNode[]
  mensaje_ui: string
}
