import type { PotionId } from "../types/game"

// ============================================================================
//   DICCIONARIO DE VARIABLES MODIFICABLES Y BALANCE GENERAL DEL JUEGO
// ============================================================================

/**
 * 1. CANTIDAD INICIAL DE POCIONES (INVENTARIO INICIAL)
 * Modifica estos valores para definir con cuántas pociones de cada tipo
 * inicia el jugador al cargar el juego o resucitar.
 */
export const INITIAL_POTIONS: Record<PotionId, number> = {
  P1: 1,   // Poción Menor de Curación
  P2: 1,   // Aceite de Puntería
  P3: 10,  // Mezcla Volátil
  P4: 1,   // Poción de Invisibilidad
  P5: 1,   // Poción de Curación Mayor
  P6: 1,   // Poción de Velocidad de Movimiento
  P7: 1,   // Suero de Disparo Múltiple
  P8: 1,   // Tónico de Hiper-Reflejos
  P9: 1,   // Escudo de Energía
  P10: 1,  // Brebaje de Cadencia Extrema
}

/**
 * 2. DURACIÓN DE LOS EFECTOS DE LAS POCIONES (en milisegundos)
 * Cambia estos valores para que los efectos de las pociones duren más o menos tiempo.
 * Nota: 1000 milisegundos equivalen a 1 segundo.
 */
export const POTION_DURATIONS = {
  INVISIBILITY: 10000, // P4: Poción de Invisibilidad (10 segundos)
  AIM: 8000,           // P2: Aceite de Puntería (8 segundos)
  SPEED: 6000,         // P6: Velocidad de Movimiento (6 segundos)
  MULTISHOT: 8000,     // P7: Suero de Disparo Múltiple (8 segundos)
  REFLEX: 10000,       // P8: Tónico de Hiper-Reflejos (10 segundos)
  SHIELD: 10000,       // P9: Escudo de Energía (10 segundos)
  CADENCE: 5000,       // P10: Brebaje de Cadencia Extrema (5 segundos)
}

/**
 * 3. MULTIPLICADORES Y EFECTOS DE LAS POCIONES
 * Modifica los multiplicadores de daño, velocidad y puntos de curación aquí.
 */
export const POTION_EFFECT_VALUES = {
  P1_HEAL: 25,           // Curación de la Poción Menor de Curación (+25 HP)
  P5_HEAL: 50,           // Curación de la Poción de Curación Mayor (+50 HP)
  AIM_DAMAGE_MULT: 1.5,  // Multiplicador de daño del Aceite de Puntería (x1.5)
  SPEED_MULT: 1.6,       // Multiplicador de velocidad de la Poción de Velocidad (x1.6)
}

/**
 * 4. CONFIGURACIÓN GENERAL DEL SISTEMA DE COMBATE
 * Modifica la vida del jugador, daño base de proyectiles, cadencia y comportamiento de enemigos.
 */
export const COMBAT_CONFIG = {
  PLAYER_MAX_HP: 100,
  PLAYER_PROJECTILE_DAMAGE: 10,
  SHOOT_COOLDOWN_MS: 500, // Tiempo de espera base entre disparos (ms)
  
  // Umbrales de detección de la Inteligencia Artificial del Jefe (en píxeles)
  VISION_RADIUS: 130,     // Dentro de este radio -> estímulo "v" (visión del boss)
  NOISE_RADIUS: 260,      // Dentro de este radio -> estímulo "r" (ruido de pasos)
  BOSS_TICK_MS: 600,      // Período de decisión de la IA (600ms para evitar saturar backend)
}
