// ==========================================
// LOGIC MODULE - Punto de entrada
// ==========================================
// Este modulo exporta toda la logica del juego traducida de Python a TypeScript.
// Todos los automatas funcionan 100% offline sin necesidad de backend.

// Modulo 1: Alquimia (Maquina de Mealy)
export { 
  procesarIngrediente, 
  MEALY_MACHINE, 
  NOMBRES_POCIONES,
  type CraftResult 
} from "./mealy"

// Modulo 2: Mazmorras (Gramatica Libre de Contexto)
export { generarMazmorra } from "./dungeon"

// Modulo 3: IA del Enemigo (Maquina de Moore)
export { 
  procesarIAEnemigo, 
  MOORE_TRANSITIONS, 
  MOORE_OUTPUTS, 
  MENSAJES_IA 
} from "./moore"

// Modulo 4: Combate (Maquina de Turing)
export { procesarDanoTuring } from "./turing"
