import { useState, useRef } from "react"
// Importamos tu nueva imagen (asegúrate de que la ruta coincida con la ubicación de tu componente)
import alquimistaImg from "../../assets/alquimista.png"

type Props = {
  onComplete: () => void
}

export function IntroCinematic({ onComplete }: Props) {
  const [step, setStep] = useState<"start" | "video">("start")
  const videoRef = useRef<HTMLVideoElement>(null)

  const handleStart = () => {
    setStep("video")
    // Esperar al siguiente render para reproducir el video con interacción de usuario previa
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.play().catch((err) => {
          console.error("Error al reproducir el video:", err)
        })
      }
    }, 50)
  }

  const handleSkipOrEnd = () => {
    // Al saltar o finalizar, hacemos fadeout o completamos la escena
    onComplete()
  }

  if (step === "start") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black overflow-hidden select-none">
        {/* Luces mágicas de fondo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-amber-500/5 blur-[80px] pointer-events-none" />

        {/* Contenido Principal */}
        <div className="relative flex flex-col items-center text-center px-4 max-w-xl z-10 animate-fade-in">

          {/* Contenedor de la nueva imagen del Alquimista */}
          <div className="relative mb-6 rounded-2xl border border-primary/20 bg-primary/5 shadow-[0_0_40px_rgba(139,92,246,0.3)] animate-pulse overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-t from-violet-900/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <img
              src={alquimistaImg}
              alt="El Alquimista Mago"
              className="w-48 h-48 md:w-56 md:h-56 object-cover hover:scale-110 hover:-rotate-2 transition-transform duration-500 pixelated"
            />
          </div>

          {/* Nuevo Título Épico */}
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 select-none">
            <span className="bg-gradient-to-r from-violet-400 via-purple-300 to-amber-300 bg-clip-text text-transparent drop-shadow-md font-cinzel-dec font-bold tracking-wide">
              EL ALQUIMISTA
            </span>
            <br />
            <span className="text-2xl md:text-3xl font-medium text-muted-foreground uppercase tracking-widest font-cinzel">
              de los autómatas
            </span>
          </h1>

          <p className="text-xs text-muted-foreground/80 mb-10 max-w-md font-medium tracking-widest font-cinzel uppercase leading-relaxed">
            Una aventura interactiva impulsada por autómatas y gramáticas formales
          </p>

          <button
            onClick={handleStart}
            className="group relative flex items-center justify-center px-12 py-4 rounded-2xl border-2 border-primary/50 bg-gradient-to-r from-violet-700 via-purple-700 to-violet-800 text-base font-bold tracking-widest text-white shadow-[0_0_24px_rgba(139,92,246,0.25)] hover:shadow-[0_0_35px_rgba(139,92,246,0.5)] backdrop-blur-md transition-all duration-300 hover:scale-105 hover:border-primary hover:from-violet-600 hover:to-purple-600 font-medieval cursor-pointer"
          >
            {/* Brillo interno */}
            <span className="absolute inset-0 rounded-2xl bg-gradient-to-r from-white/15 via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            COMENZAR LA HISTORIA
          </button>
        </div>

        {/* Firma inferior */}
        <div className="absolute bottom-6 text-[10px] tracking-wider text-muted-foreground/40 font-mono">
          PROYECTO DE AUTOMATAS Y LENGUAJES FORMALES
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center p-[10px] overflow-hidden">
      {/* Botón de saltar cinemática con Glassmorphism */}
      <button
        onClick={handleSkipOrEnd}
        className="pointer-events-auto absolute top-8 right-8 z-50 flex items-center gap-2 rounded-full border border-white/20 bg-black/40 backdrop-blur-md px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-2xl transition-all duration-300 hover:scale-105 hover:bg-white/10 hover:border-white/40"
      >
        Saltar Introducción ➔
      </button>

      {/* Reproductor de Video */}
      <video
        ref={videoRef}
        src="https://www.dropbox.com/scl/fi/gxzudd779qk5evovfj49j/cinematica_automata.mp4?rlkey=eluvew3m1qy91wpcyx7t8ap1x&st=mdmhr3qb&raw=1"
        className="w-full h-full object-contain rounded-lg bg-black"
        onEnded={handleSkipOrEnd}
        autoPlay
        playsInline
      />
    </div>
  )
}