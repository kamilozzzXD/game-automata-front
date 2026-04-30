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

### Tarea 3.2 — Combate del Jefe (Moore AI Action) y Modo Furia

**Spec corta:** materializar el comportamiento del Jefe según su Máquina de
Moore: en estado **A** patrulla lentamente, en estado **B** se queda quieto
"buscando", en estado **C** persigue al jugador y dispara cada 1.5s. Sus
proyectiles viven en un array **separado** del jugador y solo colisionan
contra él. Implementar el **Modo Furia** (Fase 2) como toggle debug
porque el sistema de HP (Tarea 3.3) aún no existe: cuando está activo,
cada disparo del jefe en estado C se sortea 50/50 entre Ataque Básico y
**Ataque Pesado**, que es 2x más grande, 20% más lento y se **fragmenta
en 8 esquirlas básicas** al expirar (vectores cardinales y diagonales
normalizados con 0.707).

**Archivos modificados:**

- `src/core/gameStore.ts` — Tres adiciones para el handoff a Tarea 3.3:
  - `isBossFurious: boolean`
  - `activarModoFuria()` — la Tarea 3.3 debe llamar a este método
    *exactamente* desde el evento "Vida 1 == 0" del jefe.
  - `desactivarModoFuria()` — para reset / debug.
  - `resetBoss()` ahora también pone `isBossFurious=false` (al entrar a
    una sala del jefe nueva, se asume Vida 1 intacta).

- `src/components/game/Projectile.tsx` — Nueva prop `variant`:
  - `"player"` (default) — `accent` amarillo.
  - `"boss-basic"` — rojo saturado, mismo tamaño base.
  - `"boss-heavy"` — morado oscuro con anillo + halo pulsante grande.
  El componente sigue siendo puramente decorativo: la lógica vive en la
  escena.

- `src/scenes/DungeonScene.tsx` — Refactor extenso:
  1. **`bossPosition`** pasó de `useMemo` a `useState<Vector2D>`. Se
     espejea en `bossPositionRef` para que el polling de la IA y los
     game loops de proyectiles no se reconstruyan a 60fps.
  2. Las dependencias `bossPosition` se eliminaron del `useEffect` del
     polling y del `useEffect` del loop de proyectiles del jugador. Ambos
     ahora leen vía `bossPositionRef.current`.
  3. **Nuevo game loop del jefe** (un único `requestAnimationFrame` que
     vive en su propio `useEffect`):
     - **Movimiento por estado de Moore.**
       - `A` → patrullaje. Elige un punto aleatorio dentro de un radio
         de 150px, camina a 1 px/frame; al llegar (distancia ≤ 4)
         reelige. Clampea a `[BOSS_WORLD_MARGIN, world - size - margin]`.
       - `B` → quieto. Resetea el target de patrullaje.
       - `C` → persecución. Avanza a 2 px/frame hacia el centro del
         jugador, respetando una distancia mínima de 60px (evita que
         su sprite se monte sobre el del jugador).
     - **Cooldown de disparo** (`BOSS_SHOOT_COOLDOWN_MS = 1500`). Solo
       dispara en estado `C`. Cada disparo apunta al jugador en el
       momento exacto del shot (vector normalizado jefe→jugador).
     - **Modo Furia.** Si `isBossFurious=true`, cada disparo sortea
       `Math.random() <= 0.5`: pesado / básico.
     - **Movimiento de los proyectiles del jefe + colisión vs jugador**
       (AABB). El proyectil pesado, al expirar por
       `BOSS_HEAVY_PROJECTILE_MAX_DISTANCE = 320` SIN haber tocado al
       jugador, se sustituye por **8 proyectiles básicos** en sus
       coordenadas con vectores `ESQUIRLAS_8_DIR` (N/S/E/O y diagonales).
     - **Limpieza.** Al salir de la sala del jefe se vacía el array y
       se resetean refs (`patrolTargetRef`, `lastBossShotAtRef`).
     - **Nota crítica de concurrencia:** el spawn de un nuevo proyectil
       y el step del array completo se consolidan en **un único
       `setBossProyectiles`** por frame (helper `buildBossShotAtPlayer`
       devuelve el objeto sin tocar el state, y `stepBossProjectiles`
       acepta un `pendingSpawn` que adjunta al final). Sin esto, la
       segunda escritura no funcional del frame pisaría a la primera.
  4. **Botón debug "Activar Furia / Desactivar Furia"** en el panel
     inferior central de la sala del jefe. Cambia el badge "FURIA" del
     panel de estado y el color del borde. Comentado para que el
     próximo dev sepa que su trabajo es **reemplazarlo por el evento
     "Vida 1 == 0"** y llamar a `useGameStore.getState().activarModoFuria()`.
  5. **Render.** Los proyectiles del jefe se pintan **antes** que los
     del jugador para que en colisiones visuales el del jugador quede
     encima, y el jugador se pinta encima de todos los proyectiles.

**Constantes nuevas (en `DungeonScene.tsx`):**

| Constante | Valor | Propósito |
|---|---|---|
| `BOSS_PATROL_SPEED` | 1 px/frame | Estado A. |
| `BOSS_ATTACK_SPEED` | 2 px/frame | Estado C. |
| `BOSS_MIN_DISTANCE_TO_PLAYER` | 60 | Persecución no se monta sobre el jugador. |
| `BOSS_PATROL_RADIUS` | 150 | Radio para escoger nuevo target en A. |
| `BOSS_PATROL_REACHED_EPSILON` | 4 | Tolerancia para "ya llegué". |
| `BOSS_SHOOT_COOLDOWN_MS` | 1500 | Cadencia de disparo en C. |
| `BOSS_BASIC_PROJECTILE_SIZE` | 18×18 | Algo mayor que el del jugador. |
| `BOSS_BASIC_PROJECTILE_SPEED` | 4 px/frame | |
| `BOSS_BASIC_PROJECTILE_MAX_DISTANCE` | 600 | |
| `BOSS_HEAVY_PROJECTILE_SIZE` | 36×36 | 2× el básico (spec). |
| `BOSS_HEAVY_PROJECTILE_SPEED` | 3.2 px/frame | 80% del básico (spec). |
| `BOSS_HEAVY_PROJECTILE_MAX_DISTANCE` | 320 | Antes fragmenta en 8. |
| `ESQUIRLAS_8_DIR` | 8 vectores unitarios | Las 8 direcciones de la fragmentación (0.707 normaliza diagonales). |

**Handoff explícito a Tarea 3.3 (HP del Jefe):**

> Cuando el sistema de vida del jefe detecte el evento `Vida 1 == 0`,
> debe llamar a `useGameStore.getState().activarModoFuria()`. El
> bucle del jefe ya está suscrito a `isBossFurious` y comenzará a
> usar Ataques Pesados aleatorios automáticamente. El botón debug
> del panel se puede borrar entonces.

**Notas de diseño:**
- Mantenemos `bossProyectiles` y `proyectiles` (jugador) en arrays
  separados por dos razones: (1) las colisiones evalúan bandos
  diferentes, (2) sus tamaños/velocidades/colores son distintos y
  meterlos en el mismo array obligaría a un campo `team` que solo
  añade ruido.
- El `Modo Furia` se subió al **store** (no a un useState local) porque
  la Tarea 3.3 lo activará desde un módulo distinto (el componente de
  HP del jefe), y Zustand permite que cualquier consumidor lo lea o lo
  invoque sin pasar props.
- Las constantes de combate están **arriba del archivo**, todas
  juntas y comentadas, para que un game-designer pueda tunear sin
  tocar la lógica.
