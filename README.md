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

---

### Tarea 8 — Responsividad Híbrida: Detección Móvil y Pantalla Completa

**Objetivo:** Crear un sistema responsivo híbrido que detecte dispositivos móviles con pantalla táctil, escale el contenedor de juego (960x600) para ocupar el máximo espacio del viewport manteniendo su relación de aspecto original 16:10 (*Letterboxing*), prevenga gestos de zoom involuntarios e integre un botón de pantalla completa flotante con manejo de fallos para iOS Safari.

**Archivos afectados:**

| Archivo | Cambio |
|---|---|
| `index.html` | Modificada la etiqueta `<meta name="viewport">` para bloquear el zoom móvil (`maximum-scale=1.0, user-scalable=no`). |
| `src/utils/debounce.ts` | **NUEVO** | Implementada la función utilitaria `debounce` para mitigar la frecuencia excesiva del evento `resize`. |
| `src/hooks/useMobileDetection.ts` | **NUEVO** | Creado el hook `useMobileDetection` para detectar `isMobile` y `isLandscape` de manera dinámica mediante `resize` optimizado con debounce. |
| `src/components/ui/FullscreenToggle.tsx` | **NUEVO** | Componente de botón translúcido flotante para activar/desactivar la pantalla completa nativa utilizando `requestFullscreen` con soporte vendor-prefixed e interceptación segura (`try/catch`) para iOS Safari. |
| `src/App.tsx` | Añadido el cálculo matemático de escalado (`scale = Math.min(window.innerWidth / 960, window.innerHeight / 600) * 0.98`) con redimensionamiento dinámico optimizado con debounce (100ms), centrando el *Ghost Wrapper* mediante Flexbox (`100vw`, `100dvh`). |
| `src/scenes/DungeonScene.tsx` | Removido el contenedor `<main>` redundante con `min-h-screen`, delegando el centrado y redimensionado al contenedor global de `App.tsx`. |
| `src/scenes/ForestScene.tsx` | Removido el contenedor `<main>` redundante con `min-h-screen`, delegando el centrado y redimensionado al contenedor global de `App.tsx`. |
| `src/components/ui/HUD.tsx` | Añadido el componente `<FullscreenToggle />` en la esquina superior derecha y desplazada la tarjeta informativa de controles de teclado a `top-16` para evitar colisión visual. |

**Decisiones de ingeniería:**

- **Prevención de Zoom e Interrupción**: Añadiendo `user-scalable=no` y `maximum-scale=1.0` al viewport, prevenimos comportamientos indeseados en navegadores móviles (doble tap/pinch-to-zoom) que descuadran el lienzo y afectan los controles táctiles.
- **Letterboxing Limpio con transform: scale**: El canvas mantiene su tamaño lógico de `960x600`, mientras que un contenedor de Flexbox centrado en `100vw`/`100dvh` y un factor de escala del `98%` aseguran que el juego ocupe el máximo espacio físico del teléfono sin deformarse y sin tocar los bordes del dispositivo.
- **Resize Debouncing**: El evento `resize` está regulado con un debounce de 100ms tanto en el hook de detección como en el componente principal, reduciendo significativamente la cantidad de recálculos de estilo y actualizaciones de estado de React durante redimensionados.
- **API Fullscreen Segura**: La función `toggleFullscreen` evalúa y soporta alternativas vendor-prefixed (`webkit`, `moz`, `ms`) para extender la compatibilidad, atrapando cualquier error con `try/catch` para evitar caídas catastróficas en iOS Safari.

---

### Tarea 9 — Interfaz Táctil: Botones de Acción Superpuestos (Mobile HUD)

**Objetivo:** Crear un panel de controles virtuales translúcidos para dispositivos móviles que permita ejecutar acciones principales (Disparar, Interactuar, Usar Poción, Inventario) con cero latencia y evitar bugs de teclas pegadas.

**Archivos afectados:**

| Archivo | Cambio |
|---|---|
| `src/components/ui/TouchControls.tsx` | **NUEVO** | Creado el componente `TouchControls` para el pad de acciones táctiles, mapeando pointer events a KeyboardEvents sintéticos. |
| `src/App.tsx` | Importado e inyectado el componente `<TouchControls />` dentro de la base del *Ghost Wrapper* para heredar la escala de lienzo dinámica. |

- **Decisiones de ingeniería:**

- **Despacho de Eventos Sintéticos de Teclado**: Al simular `KeyboardEvent('keydown')` y `KeyboardEvent('keyup')` directamente sobre `window`, el código del juego interactivo no requiere de refactorizaciones extensas. Se acopla de forma transparente a los sistemas existentes de combate y recolección.
- **Ciclo Completo de Pointer Events**: Para evitar que las teclas queden permanentemente presionadas ("teclas pegadas" o disparo infinito), se vincula el inicio en `onPointerDown` con la finalización unificada en `onPointerUp`, `onPointerLeave` y `onPointerCancel`.
- **Cero Latencia**: Al usar pointer events en lugar del retraso artificial de ~300ms de `onClick` en teléfonos, se garantiza una respuesta instantánea y de alto rendimiento en combates móviles.
- **Layout de Diamante Ergonómico y Estética Glassmorphism**: Los botones de acción se agrupan en un contenedor de `w-40 h-40` (`160x160px`) en forma de diamante (estilo gamepad tradicional), usando iconos SVG vectoriales sin texto sobre un fondo de cristal oscuro translúcido (`bg-slate-900/40 backdrop-blur-md border border-white/20`) y feedback táctil inmediato (`active:scale-95`).

---

### Tarea 10 — Degradación Gráfica Dinámica (Mobile Fallback) & Monitor de Rendimiento (FPS Counter)

**Objetivo:** Implementar un "Modo Rendimiento" automático en dispositivos móviles para mitigar la sobrecarga en la GPU limitando la resolución y deshabilitando operaciones costosas del Canvas 2D. Además, añadir un monitor científico de rendimiento (contador de FPS) dibujado en tiempo real directamente en el canvas con un semáforo visual de color.

**Archivos afectados:**

| Archivo | Cambio |
|---|---|
| `src/hooks/useCanvasLoop.ts` | Añadido soporte para limitar el `dpr` (pixel ratio) a un máximo de `1.25` en dispositivos móviles. Implementado el cálculo de FPS acumulado y dibujado del overlay de FPS en tiempo real directamente al final de cada frame en `x: 10, y: 20` sin React state. |
| `src/scenes/DungeonScene.tsx` | Importado `useMobileDetection` y configurado un `isMobileRef`. Deshabilitadas de forma condicional las propiedades `shadowBlur` y `shadowColor` de los proyectiles y simplificados los gradientes radiales del jefe a rellenos sólidos en móviles. |
| `src/scenes/ForestScene.tsx` | Importado `useMobileDetection` y pasado `isMobile` al hook `useCanvasLoop` para habilitar el límite de DPR. |

**Decisiones de ingeniería:**

- **Límite de Densidad de Píxeles (High-DPI Capping)**: En pantallas móviles de alta densidad, renderizar un canvas a 60 FPS satura la GPU móvil. Limitar la escala a `1.25` de DPR reduce drásticamente los píxeles procesados sin pérdida apreciable de nitidez.
- **Desactivación de ShadowBlur (Kill-Switch)**: El renderizado de sombras desenfocadas (`shadowBlur`) requiere cálculos de desenfoque gaussiano de alto costo por software. Desactivarlas en móviles elimina el cuello de botella.
- **Simplificación de Relleno en Proyectiles**: Reemplazar gradientes radiales continuos por rellenos sólidos (`fillStyle`) en proyectiles del jefe elimina la sobrecarga de texturas procedimentales a alta tasa de disparo.
- **Monitor de Rendimiento Cero React State**: El cálculo de FPS se realiza midiendo los cuadros por cada período de refresco de 500ms utilizando `performance.now()`. Al dibujarse directamente en el contexto del canvas con `ctx.fillText`, se evita desencadenar re-renders de React y el parpadeo constante, y se implementa una codificación semáforo de colores (Verde > 45 FPS, Amarillo > 30 FPS, Rojo <= 30 FPS).

---

### Sprint Polish-Pass — Ajustes de Pulido: UX & Pipeline Gráfico

**Objetivo:** Pulir y optimizar la experiencia visual en PC. Resolver el orden de capas de proyectiles en la oscuridad, evitar la salida involuntaria del modo pantalla completa de los navegadores mediante teclas conflictivas, y eliminar parpadeos/pop-in de imágenes de la UI usando precarga ansiosa.

**Archivos afectados:**

| Archivo | Cambio |
|---|---|
| `src/scenes/DungeonScene.tsx` | Reubicado el bucle de dibujado de proyectiles del jugador para que se ejecute después del renderizado del overlay de la viñeta de oscuridad. |
| `src/components/ui/CraftingModal.tsx` | Cambiado el listener de cierre de `Escape` a la tecla `X` / `x` y modificado el botón visual para indicar "Cerrar (X)", evitando la salida involuntaria de Fullscreen del navegador. |
| `src/App.tsx` | Importado `loadImage` y los tres assets de imagen pesados de UI (`ventana-muerte.png`, `victoria-jugador.png` y `guia.png`) para precargarlos ansiosamente en el montaje inicial del juego. |

**Decisiones de ingeniería:**

- **Orden de Capas Gráficas**: Al desvincular los proyectiles del jugador del Y-sorting general y dibujarlos directamente después del overlay de la viñeta de oscuridad, se crea el efecto de que la magia del jugador brilla en la oscuridad por encima de la capa negra.
- **Evitar Escape Key Conflict**: La tecla `Escape` tiene un comportamiento nativo inmutable en navegadores que desactiva el modo Pantalla Completa. Mapear el atajo del modal a la tecla `X` previene esta interrupción de UX manteniendo la pantalla completa intacta.
- **Precarga Ansiosa (Eager Preloading)**: Forzar la instanciación de elementos `new Image()` y setear sus fuentes en el arranque del juego almacena en caché las imágenes pesadas de los modales (Muerte, Victoria y Guía) de antemano, resultando en transiciones de UI instantáneas y sin parpadeos.









