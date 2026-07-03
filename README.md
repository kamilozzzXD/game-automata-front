# El Alquimista de los Autómatas — Game Automata

Motor de juego 2D basado en autómatas finitos, construido con **React + TypeScript + Vite**.

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| UI / Componentes | React 18 + TypeScript |
| Estado global | Zustand (`useGameStore`) |
| Motor gráfico | HTML5 Canvas (`useCanvasLoop`) |
| Bundler | Vite |
| Estilos | Tailwind CSS |
| Backend / IA | API REST (autómatas de Moore) |

## Scripts disponibles

```bash
pnpm dev        # Servidor de desarrollo con HMR
pnpm build      # Bundle de producción
pnpm lint       # ESLint
```

## Arquitectura de escenas

```
src/
├── hooks/
│   ├── useCanvasLoop.ts      # Motor gráfico (rAF + High-DPI)
│   ├── useGameKeyboard.ts    # Captura de teclado
│   ├── useHotbarControls.ts  # Barra de pociones
│   └── usePlayerMovement.ts  # Física del jugador
├── scenes/
│   ├── ForestScene.tsx       # Claro del bosque (crafteo + portal)
│   └── DungeonScene.tsx      # Mazmorra procedural (combate + IA)
├── components/
│   ├── game/                 # Entidades del mundo (Boss, Projectile, …)
│   └── ui/                   # HUD, barras de vida, modales
├── core/
│   ├── gameStore.ts          # Estado global (Zustand)
│   ├── geometry.ts           # Utilidades AABB / distancia
│   └── dictionary.ts         # Textos y constantes de juego
├── utils/
│   └── assetLoader.ts        # Precarga de texturas (Promises)
└── services/
    └── api.ts                # Llamadas al backend de autómatas
```

---

## Changelog técnico

### Tarea 1.1 — Lienzo Base y Capa de Abstracción Gráfica

**Archivos afectados:**

| Archivo | Operación | Rol |
|---|---|---|
| `src/hooks/useCanvasLoop.ts` | **NUEVO** | Hook reutilizable que encapsula el bucle `requestAnimationFrame`, gestiona High-DPI y destruye la animación al desmontar. |
| `src/scenes/DungeonScene.tsx` | **MODIFICADO** | Monta el canvas base en z-0 con fondo oscuro de piedra y rejilla técnica de 40 px. |
| `src/scenes/ForestScene.tsx` | **MODIFICADO** | Monta el canvas base en z-0 con fondo tonal verde-bosque y rejilla técnica de 40 px. |

**Decisiones de ingeniería:**

- **High-DPI / Retina** — El buffer físico del canvas se escala por `window.devicePixelRatio` (ej. 1920×1200 px en pantallas 2×) manteniendo el tamaño CSS fijo a 960×600 px mediante `ctx.scale(dpr, dpr)`.
- **Destrucción de hilos** — El cleanup del `useEffect` llama a `cancelAnimationFrame(animationFrameId)` para evitar degradación de CPU al cambiar de escena.
- **Anti-stale closures** — El callback `draw` se guarda en un `useRef` actualizado en cada render, desacoplando el bucle asíncrono del ciclo de renders de React.
- **Rejilla técnica** — 24 líneas verticales + 16 horizontales cada 40 px, dibujadas en modo semi-transparente para no interferir con las capas HTML superiores.

---

### Tarea 2.1 — Renderizado del Jugador y Animación LPC

**Archivos afectados:**

| Archivo | Operación | Rol |
|---|---|---|
| `src/utils/assetLoader.ts` | **NUEVO** | Centraliza la precarga asíncrona de imágenes mediante Promesas, evitando fallos de renderizado en frío. |
| `src/scenes/DungeonScene.tsx` | **MODIFICADO** | Pinta el jugador por sprite clipping dentro del canvas; la animación se calcula con `performance.now()`. |
| `src/scenes/ForestScene.tsx` | **MODIFICADO** | Ídem para la escena del bosque. |
| `src/components/game/Player.tsx` | **ELIMINADO** | Componente DOM purgado; cero nodos HTML dedicados al jugador en el árbol. |

**Decisiones de ingeniería:**

- **Precarga obligatoria** — `loadImage(url)` retorna una `Promise<HTMLImageElement>` y guarda el resultado en un `useRef`. El `draw` callback comprueba `playerSpriteRef.current` antes de llamar a `ctx.drawImage`, evitando errores en frío.
- **Animación gated por tiempo físico** — Se elimina el `setInterval` y el estado `frameIndex` de React. La columna de frames se computa como `Math.floor(performance.now() / 80) % 9` directamente en el rAF, sin causar re-renders.
- **Alineación geométrica LPC** — La matriz de la hoja de sprites usa frames de 64×64 px. Las filas se mapean: 8=Arriba, 9=Izquierda, 10=Abajo, 11=Derecha. El sprite se dibuja con desfase de `-8px / -12px` para centrar el gráfico de 64 px sobre la colisión física de 48 px.
- **Invisibilidad** — `ctx.globalAlpha = 0.4` cuando `isPlayerInvisible` está activo; se restaura a `1` al terminar el frame.

---

### Bugfix Visual — Corrección de Z-Index y Transparencia de Contenedores DOM

**Problema:** Capas HTML opacas encima del canvas ocultaban el renderizado nativo (sprite "fantasmagórico" en bosque, invisible en mazmorra).

**Archivos afectados:**

| Archivo | Cambio |
|---|---|
| `src/scenes/ForestScene.tsx` | Eliminados los dos `div` de fondo opaco (`radial-gradient` + `repeating-linear-gradient`). El canvas ya pinta el suelo. |
| `src/components/game/DungeonRoom.tsx` | Eliminados el `div` de fondo por habitación (`getRoomStyle`) y la textura de adoquín semi-opaca. El `div` raíz queda transparente. |
| `src/scenes/DungeonScene.tsx` | Migrado el vignette spotlight de un `div` DOM a `zIndex: 12` al propio canvas draw callback (pintado *antes* del sprite del jugador). Añadido `bossRoomRef` para leer `bossPresent` sin stale closure. |

**Decisiones de ingeniería:**

- **Separación clara de capas**: Canvas (z-0) = fondo + vignette + jugador. DOM = decoraciones semi-transparentes + UI. Nunca un `div` opaco encima del canvas.
- **Vignette en canvas**: Al dibujar la oscuridad dentro del bucle rAF (antes del sprite), el personaje siempre aparece *dentro* del cono de luz, sin necesidad de z-index elevado en el DOM.
- **`bossRoomRef`**: Un ref actualizado en cada render permite que el draw callback (closure asíncrona) lea el estado de `bossPresent` sin capturarlo como valor obsoleto.
- **`pointer-events-none` en canvas**: El canvas recibe el atributo para que los clics no se bloqueen y alcancen los elementos UI superpuestos.

---

### Tarea 4 — Sistema de Proyectiles del Jugador (Batch Drawing)

**Objetivo:** Migrar los proyectiles del jugador del DOM y de ciclos reactivos de React a una referencia TypeScript pura y dibujado por lotes acelerado por hardware dentro de la capa del canvas.

**Archivos afectados:**

| Archivo | Cambio |
|---|---|
| `src/scenes/DungeonScene.tsx` | Eliminado el estado de proyectiles reactivo, modificado el crafteo de `P3` (Mezcla Volátil) y el listener de teclado para interactuar mediante `useRef`, e implementado el procesamiento de física, lógica de daño y renderizado con glow en el canvas draw loop. |

**Decisiones de ingeniería:**

- **Física Silenciosa e Inercia de Renders**: Los proyectiles del mago se almacenan en `proyectilesRef` (`useRef`). Al presionar la tecla J, se inyectan elementos al array del ref. Cero re-renders de React disparados en combate por proyectiles.
- **Disparo Continuo en rAF**: Se lee el estado del input mediante `keysRef.current.has("j")` a 60 FPS dentro de `drawDungeon`. Esto permite disparar ráfagas fluidas a la tasa exacta de cooldown configurada por pociones activas, saltándose limitaciones y retrasos de eventos de teclado de los navegadores.
- **Filtro de Memoria Invertido**: La remoción de proyectiles (por impacto, fuera de límites o rango) se realiza con un bucle invertido (`for (let i = arr.length - 1; i >= 0; i--)`), garantizando mutaciones estables in-situ sin desfases de índices.
- **Nacimiento desde el Centro**: El cálculo geométrico inicial del proyectil inicia en el punto central real de la colisión del mago (`x + 24`, `y + 24`).
- **Glow nativo acelerado**: Se aplica `shadowBlur = 8` y `shadowColor = "#eab308"` nativo en el contexto 2D de canvas para lograr proyectiles incandescentes sin sobrecarga de nodos DOM.

