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

---

### Refactorización Visual de Proyectiles — Asset de Bola de Fuego con Rotación Dinámica

**Objetivo:** Reemplazar los círculos primitivos del jugador por un asset de bola de fuego (`fireball.png`) dibujado eficientemente y orientado dinámicamente según su trayectoria en el Canvas.

**Archivos afectados:**

| Archivo | Cambio |
|---|---|
| `src/scenes/DungeonScene.tsx` | Precarga del asset `fireball.png`, inicialización de `fireballSpriteRef` y renderizado rotado dinámicamente mediante matriz de transformación (`translate` + `rotate`) en el canvas draw loop. |
| `src/assets/fireball.png` | **NUEVO** | Asset gráfico de bola de fuego (copia/adaptación optimizada) cargado dinámicamente. |

**Decisiones de ingeniería:**

- **Precarga Asíncrona Seguro**: La textura se carga al inicio con la utilidad `loadImage` y se guarda en `fireballSpriteRef`. Mientras carga, el sistema automáticamente realiza un fallback visual al círculo primitivo para evitar interrupciones o fallos.
- **Rotación por Trigonometría del Vector de Movimiento**: Se determina la orientación exacta del proyectil calculando `Math.atan2(p.dy, p.dx)` de forma instantánea en cada frame.
- **Transformación de Contexto Limpia**: Cada proyectil se dibuja guardando la matriz (`ctx.save`), trasladando el origen a la posición del proyectil (`ctx.translate`), rotando el contexto (`ctx.rotate`) y dibujando la imagen centrada (`-16, -16` para escala `32x32px`), seguido del correspondiente `ctx.restore` para no contaminar al resto de elementos.

---

### Tarea 3 — Migración del Jefe y Renderizado de Estados de Moore

**Objetivo:** Trasladar la representación visual del jefe final de la mazmorra de la capa DOM al `<canvas>` (z-0), dibujando dinámicamente su sprite y su badge flotante analítico de la máquina de Moore utilizando texto nativo acelerado por hardware.

**Archivos afectados:**

| Archivo | Cambio |
|---|---|
| `src/core/gameStore.ts` | Añadidos `bossPosition` y `currentBossState` (con setters) para la sincronía centralizada de Zustand sin stale closures. |
| `src/scenes/DungeonScene.tsx` | Precarga del spritesheet del jefe, sincronización de la física e inyección de la animación y badge analítico en el canvas loop. |
| `src/components/game/Boss.tsx` | **ELIMINADO** | Componente DOM purgado; cero nodos HTML de jefe en el árbol. |

**Decisiones de ingeniería:**

- **Animación e Integridad de Sprite Clipping**: Mapeo dinámico de estados a filas del spritesheet LPC: `A` / `B` (Caminar a 9 frames con dirección calculada de `bossDirectionRef`) y `C` (Ataque a fila 2 de 7 frames).
- **Centrado Geométrico Preciso**: El dibujo del cuadro 64x64 se desplaza con offset de `+8px` para quedar perfectamente centrado en su caja de colisión de 80x80px.
- **Badge de Moore Aislado**: Dibujado con `ctx.fillText` usando Courier New, aislado de forma segura mediante `ctx.save()` / `ctx.restore()` y pintado en color magenta `#d946ef` si está furioso o blanco `#ffffff` por defecto.
- **Cero Fallos Silenciosos**: Implementado fallback visual que dibuja un círculo rojo de radio 40px en caso de error o retraso en la carga del asset.

---

### Tarea 5 — Proyectiles del Jefe y Fragmentación en Modo Furia

**Objetivo:** Migrar todo el sistema de combate a distancia del jefe al `<canvas>`. Implementar el renderizado visual de proyectiles Básicos, Pesados (con resplandor) y Venenosos usando gradientes radiales nativos, y procesar la fragmentación matemática en 8 esquirlas (Bullet-Hell) sin causar caídas de FPS.

**Archivos afectados:**

| Archivo | Cambio |
|---|---|
| `src/scenes/DungeonScene.tsx` | Eliminado el estado de proyectiles del jefe reactivo, modificado el disparo de la IA y el mini-jefe para inyectar directamente en `bossProyectilesRef`, e implementadas la física, colisiones, fragmentación y pintado de gradientes de color en el canvas draw loop. |

**Decisiones de ingeniería:**

- **Física y Fragmentación en una Sola Pasada**: Las físicas y colisiones de los proyectiles se computan e iteran en sentido inverso (`for (let i = bossProjs.length - 1; i >= 0; i--)`). Al expirar un proyectil de tipo `boss-heavy` por haber recorrido su distancia máxima, se inyectan en el mismo array 8 proyectiles de tipo `boss-basic` en direcciones unitarias diagonales y cardinales.
- **Renderizado por Hardware con Gradientes Radiales**: Cada proyectil se dibuja usando un gradiente radial (`ctx.createRadialGradient`) con núcleo caliente blanco y difuminado exterior correspondiente a su naturaleza (`#d946ef` / magenta para Pesado, `#ef4444` / rojo para Básico y `#10b981` / verde para Veneno).
- **Glow Específico en GPU**: Se aplican efectos inestables de resplandor mediante `shadowBlur = 15` y `shadowColor = "#a855f7"` solo para los proyectiles de tipo pesado.
- **Colisiones AABB sin Bloqueos**: Detección de colisiones instantánea con `intersectsAABB` entre la caja del jugador y el proyectil. Si el jugador es impactado y no está protegido por escudo, se efectúa la sustracción de vida asíncrona vía API Turing y se notifica visualmente.

---

### Tarea 6 — Cierre de Deuda Técnica y Optimización Algorítmica

**Objetivo:** Modificar los algoritmos matemáticos base y la captura de eventos táctiles para mitigar el estrangulamiento térmico (throttling) y la saturación del Event Loop en dispositivos móviles.

**Archivos afectados:**

| Archivo | Cambio |
|---|---|
| `src/core/geometry.ts` | Refactorizado `isWithinRadius` y añadida `intersectsCircleOptimized` para evitar raíces cuadradas mediante la comparación de **distancias al cuadrado** directas. |
| `src/scenes/DungeonScene.tsx` | Optimizado el cálculo del near-miss, la detección de rango de la IA, el rango del Mini-Boss y la iluminación de Hazards para usar distancia cuadrática directa. Renders de `MobileHUD` incorporados. |
| `src/scenes/ForestScene.tsx` | Renders de `MobileHUD` incorporados. |
| `src/hooks/usePlayerMovement.ts` | Añadido soporte de movimiento por vector de joystick táctil. |
| `src/core/gameStore.ts` | Definida la propiedad `joystickVector` de tipo `Vector2D` y su acción `setJoystickVector`. |
| `src/components/ui/MobileHUD.tsx` | **NUEVO** | Componente táctil de Joystick Virtual flotante que implementa acumulación (*Gating*) a 60 FPS mediante `requestAnimationFrame` del evento `pointermove`. |

**Decisiones de ingeniería:**

- **Eliminación Absoluta de Math.sqrt**: Todos los chequeos de radio (rango de la IA, near miss de proyectiles, iluminación de trampas e interacciones con el caldero/portal) se reemplazaron por comparaciones de distancias al cuadrado (`dx * dx + dy * dy <= r * r`), reduciendo significativamente la carga aritmética en la CPU a 60 FPS.
- **Joystick Virtual Táctil con Gating**: Los eventos de arrastre en el joystick virtual se leen a alta velocidad en memoria local (`pendingVectorRef`) y se despachan a Zustand estrictamente a una cadencia de 60 FPS dentro de un bucle gestionado por `requestAnimationFrame`, previniendo la degradación y lag en pantallas de 120Hz/240Hz.

---

### Tarea 7.1 — Bugfix: Ordenamiento de Profundidad (Restricción Visual)

**Objetivo:** Corregir el error visual donde el Jugador camina por debajo de los elementos del piso que viven en el DOM, manteniendo los elementos de altura (Árboles, Caldero, Portal) intactos en el DOM.

**Archivos afectados:**

| Archivo | Cambio |
|---|---|
| `src/scenes/DungeonScene.tsx` | Eliminados `<HazardTile />` e `<IngredientItem />` del JSX. Implementada la migración de elementos del suelo (trampas de lava, fosas de picos, e ingredientes) al canvas en el Paso 2 antes del dibujado del jugador y jefe. |
| `src/scenes/ForestScene.tsx` | Eliminado el camino de tierra en div del JSX. Implementada la migración del camino de tierra al canvas en el Paso 2. |

**Decisiones de ingeniería:**

- **Orden Secuencial de Capas**: Se estableció el orden de dibujado en el Canvas: Paso 1 (Fondo y cuadrícula) -> Paso 2 (Trampas, picos, charcos e ingredientes/materiales del suelo) -> Paso 3 (Proyectiles, jugador y jefe).
- **Conservación de Altura en DOM**: El Portal, el Caldero y los Árboles permanecen en el DOM, logrando una ilusión de profundidad natural sin sobrecargar el canvas ni alterar el diseño original.
- **Renders del Suelo Procedurales**: Los charcos de lava y picos se dibujan proceduralmente en el canvas, y los ingredientes se representan con emojis flotantes oscilatorios simples a 60 FPS.

---

### Tarea 7.2 — Migración Definitiva a Canvas y Y-Sorting Tridimensional

**Objetivo:** Eliminar las barreras entre el DOM y el motor gráfico moviendo los elementos de altura restantes (Árboles, Caldero, Portal) al Canvas. Implementar un algoritmo de Y-Sorting puro para la superposición de profundidad y rediseñar procedimentalmente los peligros del suelo para que respeten la perspectiva *top-down*.

**Archivos afectados:**

| Archivo | Cambio |
|---|---|
| `src/scenes/ForestScene.tsx` | Migración de pinos, portal y caldero al lienzo con funciones procedimentales de dibujado. Remoción del map de árboles del JSX. Limpieza de elementos DOM configurando `<Portal />` y `<Cauldron />` con `onlyOverlay={true}`. Implementación de Paso 3 con array dinámico `renderables` Y-Sorted. |
| `src/scenes/DungeonScene.tsx` | Migración del portal de salida, llave dorada y pedestal al lienzo. Rediseño visual de picos top-down en 3D (con sombreado de aristas metálicas) y lava orgánica (charcos con curvas de Bézier/elipses y burbujas). Implementación de Paso 3 Y-Sorted (Player, Boss, exit Portal, key y projectiles). |
| `src/components/game/Cauldron.tsx` | Añadido soporte para el prop `onlyOverlay?: boolean` para saltarse el dibujado de iconos y renderizar puramente los prompts interactivos en HTML. |
| `src/components/game/Portal.tsx` | Añadido soporte para el prop `onlyOverlay?: boolean` para renderizar puramente las etiquetas textuales del portal. |

**Decisiones de ingeniería:**

- **Organic Lava & Spikes**: La lava ya no se pinta como un círculo perfecto; se compone de superposiciones de elipses simulando un charco orgánico con burbujas de calor dinámicas. Los picos se dibujan desde una perspectiva top-down usando triángulos sombreados metálicos (con arista de luz y sombra) en lugar de púas verticales planas.
- **Y-Sorting Unificado por Base**: Las entidades con altura (Jugador, Jefe, pinos, portal, caldero, pedestal, y proyectiles) se agrupan en cada frame en una lista dinámica de renderizables y se ordenan por su coordenada de anclaje base (`yBase = y + height`). Esto garantiza que el jugador y el jefe se traslapen correctamente delante o detrás de los árboles u otros elementos según su posición física 2.5D.
- **HTML Overlays**: Para retener la accesibilidad y el dinamismo de los menús e interacciones de usuario, los prompts textuales de interaccion (`Pulsa [E] para usar`, etc.) continúan en el DOM superpuestos con absoluta precisión y nulo impacto en el renderizado del lienzo principal.






