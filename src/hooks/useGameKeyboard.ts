import { useEffect, useRef } from "react"

/**
 * Hook centralizado de teclado para el juego.
 * Mantiene un Set con las teclas que estan presionadas en este momento.
 * Devuelve un ref (no causa re-renders) para que otros hooks
 * (como usePlayerMovement con requestAnimationFrame) lo lean a 60fps.
 */
export function useGameKeyboard(enabled: boolean) {
  const keysRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!enabled) {
      keysRef.current.clear()
      return
    }

    const handleDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase())
    }
    const handleUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase())
    }
    const handleBlur = () => keysRef.current.clear()

    window.addEventListener("keydown", handleDown)
    window.addEventListener("keyup", handleUp)
    window.addEventListener("blur", handleBlur)

    return () => {
      window.removeEventListener("keydown", handleDown)
      window.removeEventListener("keyup", handleUp)
      window.removeEventListener("blur", handleBlur)
    }
  }, [enabled])

  return keysRef
}
