# Análisis del Proyecto — `game-automata-front`

> Documento vivo. Se actualiza al final de cada tarea con la sección
> **"Cambios aplicados"** correspondiente, indicando archivos exactos y qué se hizo.

## 1. Stack y configuración

| Pieza | Detalle |
|---|---|
| Bundler | **Vite 8** (`vite.config.ts`) |
| Lenguaje | **TypeScript** (`tsconfig.app.json`, `tsconfig.node.json`) |
| Framework | **React 19.2** (no Next.js, no SSR) |
| Estilos | **Tailwind CSS v4** (plugin `@tailwindcss/vite`, no hay `tailwind.config.js`) |
| Estado global | **Zustand 5** (`src/core/gameStore.ts`) |
| Iconografía | **react-icons** (set `gi` y `fa`) |
| Package manager | **pnpm** (presente `pnpm-lock.yaml`) |
| Scripts | `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm preview` |
| Backend | API REST FastAPI externa en `VITE_API_URL` (default `http://localhost:8000`). **No** está en este repo. |

## 2. Concepto del juego

Juego top-down 2D estilo Zelda clásico que enseña tres conceptos formales de
Lenguajes y Autómatas:

1. **Máquina de Mealy** — crafteo de pociones en el caldero (5 ingredientes, 10
   pociones posibles). Estado en `automatonState` del store.
2. **Gramática Libre de Contexto (GLC)** — generador procedural de mazmorras.
   El backend devuelve un AST que el frontend reconstruye como habitaciones
   conectadas por puertas.
3. **Máquina de Moore** — IA del jefe en la última sala de la mazmorra. Estados
   `A` (Patrullar) / `B` (Buscar) / `C` (Atacar) y estímulos `r` (ruido) /
   `v` (visión) / `p` (pérdida de visión).

El juego tiene **dos escenas** que se intercambian con `currentScene`:

- **Bosque** (`src/scenes/ForestScene.tsx`): claro con caldero + portal hacia la mazmorra.
- **Mazmorra** (`src/scenes/DungeonScene.tsx`): conjunto de habitaciones reconstruidas desde el AST.

## 3. Mapa exacto de archivos

### Entrada
| Archivo | Rol |
|---|---|
| `index.html` | Único HTML, monta `#root`. |
| `src/main.tsx` | Bootstrap React. |
| `src/App.tsx` | Router de escenas (lee `currentScene` del store). |

### Estado y dominio
| Archivo | Rol |
|---|---|
| `src/core/gameStore.ts` | **Store Zustand global**. Posición, inventario, hotbar, mazmorra, IA del jefe, invisibilidad, notificaciones. Es la fuente de verdad. |
| `src/core/geometry.ts` | Utilidades matemáticas: `distance`, `center`, `isWithinRadius`, `intersectsAABB` (Axis-Aligned Bounding Box). |
| `src/core/dictionary.ts` | Traducciones backend↔jugador: `INGREDIENT_NAMES`, `POTION_NAMES`, `POTION_COLORS`, `DUNGEON_NODE_NAMES`, etc. |

### Tipos
| Archivo | Contenido |
|---|---|
| `src/types/game.ts` | `Vector2D`, `Size`, `Ingredient`, `PotionId`, `AutomatonState`, `TransitionOutput`, `CraftRequest/Response`, `Interactable`. |
| `src/types/dungeon.ts` | `DungeonNodeType`, `DungeonNode`, `DungeonResponse`. |
| `src/types/boss.ts` | `BossState`, `BossStimulus`, `BossAction`, `BossRequest/Response`, `parseBossState`. |

### Servicios
| Archivo | Rol |
|---|---|
| `src/services/api.ts` | 3 fetch al backend FastAPI: `craft()`, `generateDungeon()`, `bossAction()`. |

### Hooks
| Archivo | Rol |
|---|---|
| `src/hooks/useGameKeyboard.ts` | Mantiene un `Set<string>` con teclas presionadas (lowercase) en un `ref`. No causa re-renders. Limpia el set en `blur`. |
| `src/hooks/usePlayerMovement.ts` | Bucle `requestAnimationFrame` que lee el `keysRef`, normaliza diagonal con Pitágoras, aplica `delta time` (velocidad 220 px/s por defecto), hace clamp al mundo y empuja la nueva posición al store. |
| `src/hooks/useHotbarControls.ts` | Tab / ↑↓ ciclan slot; 1-9/0 selección directa; **Q** consume y dispara `onUsePotion`. |

### Componentes — juego
| Archivo | Rol |
|---|---|
| `src/components/game/Player.tsx` | Sprite circular del mago (`GiWizardFace`). Lee `isPlayerInvisible` del store para bajarse la opacidad. |
| `src/components/game/Boss.tsx` | Sprite del jefe + badge flotante con su estado de Moore (`A`/`B`/`C`). |
| `src/components/game/Cauldron.tsx` | Caldero del bosque (no relevante para esta tarea). |
| `src/components/game/Portal.tsx` | Portal mágico (lo usan ambas escenas: entrada y salida de mazmorra). |
| `src/components/game/DungeonRoom.tsx` | Capa de fondo + decoración por tipo de nodo (`inicio` / `pasillo` / `sala` / `jefe`). Solo visual, no añade colisiones. |

### Componentes — UI
| Archivo | Rol |
|---|---|
| `src/components/ui/HUD.tsx` | Inventario (toggle con tecla `I`), contadores y panel de controles a la derecha. |
| `src/components/ui/PotionHotbar.tsx` | Barra vertical de 10 slots de pociones. |
| `src/components/ui/CraftingModal.tsx` | Modal de crafteo (Mealy). |
| `src/components/ui/Notifications.tsx` | Toasts flotantes. |

### Escenas
| Archivo | Rol |
|---|---|
| `src/scenes/ForestScene.tsx` | Bosque: caldero + portal. Usa `useGameKeyboard`, `usePlayerMovement`, `useHotbarControls`. |
| `src/scenes/DungeonScene.tsx` | Mazmorra: reconstruye AST → habitaciones con puertas, transiciones por AABB, polling de IA del jefe cada `BOSS_TICK_MS=600ms`, jefe spawnea en pared opuesta a la entrada (`getBossPosition`). |

## 4. Convenciones del código

- Posiciones (`Vector2D`) son la **esquina superior-izquierda** de la entidad. Para distancias se usa `center()`.
- Tamaños canónicos: `WORLD_SIZE = { 960, 600 }`, `PLAYER_SIZE = { 48, 48 }`, `BOSS_SIZE = { 80, 80 }`.
- Movimiento: WASD o flechas. Velocidad y normalización ya están en `usePlayerMovement`.
- Interacciones: tecla **E** dentro de `interactionRadius`. Hotbar con **Tab/↑↓/1-9/0/Q**. Inventario con **I**.
- En componentes que se actualizan a 60fps NO se mete dependencia en el `useEffect`: se lee con `useGameStore.getState()` o vía refs (patrón usado en `usePlayerMovement` y en el polling del jefe).
- Tailwind: paleta semántica (`bg-background`, `text-foreground`, `bg-primary`, `text-destructive`, …). No se usan colores absolutos.

## 5. Cómo se conectan las piezas (flujo runtime)

```
useGameKeyboard  ──►  keysRef (Set<string>)
                            │
                            ▼
                  usePlayerMovement (rAF)
                            │
                            ▼
                  setPlayerPosition (store)
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
           Player       DungeonScene   ForestScene
                       (AABB doors,    (E -> portal,
                        boss polling,   E -> caldero,
                        boss collision) modal crafting)
```

---

## 6. Tareas implementadas

### Tarea 3.1 — Mecánicas del Jugador (Ataque y Orientación)

**Spec corta:** sistema de 8 direcciones (`lastDirection`), indicador visual
de apuntado solo mientras se mueve, disparo con tecla **J**, game loop con
`requestAnimationFrame` para los proyectiles, colisión AABB contra el jefe y
limpieza por distancia (>400px) o salida de pantalla.

**Archivos modificados:**

- `src/core/gameStore.ts` — Se añadió el estado global de orientación:
  - `lastDirection: { dx, dy }` (default `{0, 1}` mirando abajo) + `setLastDirection`.
  - `isPlayerMoving: boolean` + `setIsPlayerMoving`. Sirve para mostrar/ocultar
    el indicador de apuntado de forma reactiva sin acoplar `Player` al hook
    de movimiento.

- `src/hooks/usePlayerMovement.ts` — El bucle `requestAnimationFrame`:
  1. Calcula el vector `(dx, dy)` igual que antes.
  2. Si `dx !== 0 || dy !== 0`, normaliza y **escribe en el store**:
     `setLastDirection({ dx, dy })` y `setIsPlayerMoving(true)`.
  3. Si las teclas están sueltas, **NO** resetea `lastDirection` (clave del
     enunciado), solo pone `setIsPlayerMoving(false)`. Así, al disparar
     estando quieto, se conserva la última orientación.
  4. Para no spamear el setter, solo escribe cuando cambia el flag o cuando
     cambia el vector.

- `src/components/game/Player.tsx` — Indicador visual de apuntado:
  - Pequeña flecha (`FaLocationArrow` de `react-icons/fa`) que orbita al
    jugador a una distancia fija con `transform: translate(-50%, -50%)
    rotate(deg) translate(R)`.
  - Ángulo: `Math.atan2(dy, dx) * 180 / Math.PI`. Como la flecha del icono
    apunta hacia arriba-derecha (NE), se le suma un offset de `-45deg` para
    alinearla con el vector.
  - Visibilidad: `opacity-0` cuando `!isPlayerMoving`, con `transition` para
    que aparezca/desaparezca suave.

- `src/components/game/Projectile.tsx` *(archivo nuevo)* — Sprite del
  proyectil. Bola circular pequeña con glow del color `accent`, posicionada
  via `left/top` desde el centro `(x, y)` (a diferencia de Player, que usa
  esquina sup-izq). Es decoración pura: la lógica vive en `DungeonScene`.

- `src/scenes/DungeonScene.tsx` — Sistema de combate:
  1. **Estado:** `const [proyectiles, setProyectiles] = useState<Projectile[]>([])`.
  2. **Disparo (tecla J):** `useEffect` que escucha `keydown`. Solo activo
     cuando el movimiento está habilitado y el jugador está en la sala del
     jefe (`bossPresent`). Crea un proyectil con
     `{ id: Date.now()+rand, x, y, dx, dy, distanciaRecorrida: 0 }`
     posicionado en el centro del jugador, con la dirección leída del
     store (`lastDirection`). Se aplica un cooldown de **180ms** para que
     mantener J pulsada no spawnee 60 proyectiles por segundo.
  3. **Game loop (rAF):** `useEffect` independiente que arranca un
     `requestAnimationFrame` mientras haya proyectiles. Cada frame:
     - Suma `dx * SPEED` y `dy * SPEED` a la posición (SPEED = 6 px/frame).
     - Acumula `distanciaRecorrida`.
     - Filtra los que se salen de pantalla o pasaron `MAX_DISTANCE = 400`.
     - Para cada uno revisa colisión AABB contra el rect del jefe usando
       `intersectsAABB` de `geometry.ts`. Si impacta:
       `console.log("[v0] ¡Impacto al Jefe!")` y se elimina el proyectil.
  4. **Render:** los proyectiles se renderizan dentro del contenedor de la
     escena con `<Projectile />` para cada uno, debajo del HUD.
  5. **Indicador de tecla J:** se añadió al panel de controles del HUD
     (`src/components/ui/HUD.tsx`) la línea con la tecla `J` para disparar.

- `src/components/ui/HUD.tsx` — Sólo se añadió la fila de la tecla `J` en el
  panel de controles para que el jugador descubra el mecanismo.

**Notas de diseño:**
- Los proyectiles viven como **estado local** de `DungeonScene`, no en el
  store global. Razón: cambian a 60fps y mover esto a Zustand provocaría
  re-renders en cualquier componente que se suscriba al store.
- La tecla J **solo dispara dentro de la sala del jefe** porque es donde
  hay un objetivo. Mantener `lastDirection` en el store permitiría
  extenderlo al bosque sin cambios estructurales si en el futuro hay
  enemigos allí.
- El indicador de apuntado se ancla al store (`isPlayerMoving`) para que
  funcione idéntico en bosque y mazmorra — sin tener que pasar props
  hasta `Player`.
