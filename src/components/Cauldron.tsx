import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Droplet, Leaf, Gem, FlaskConical, Sparkles, RotateCcw } from 'lucide-react'

interface CraftResponse {
  nuevo_estado: string
  salida: string
  mensaje_ui: string
}

interface Ingredient {
  id: string
  token: 'A' | 'B' | 'C'
  name: string
  icon: React.ReactNode
  color: string
  bgColor: string
  borderColor: string
}

const ingredients: Ingredient[] = [
  {
    id: 'agua',
    token: 'A',
    name: 'Agua',
    icon: <Droplet className="w-8 h-8" />,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/50',
  },
  {
    id: 'hierba',
    token: 'B',
    name: 'Hierba',
    icon: <Leaf className="w-8 h-8" />,
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/50',
  },
  {
    id: 'cristal',
    token: 'C',
    name: 'Cristal',
    icon: <Gem className="w-8 h-8" />,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500/50',
  },
]

// Confetti component for victory animation
function Confetti() {
  const confettiPieces = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 1 + Math.random() * 1,
    color: ['#fbbf24', '#34d399', '#60a5fa', '#f472b6', '#a78bfa'][Math.floor(Math.random() * 5)],
  }))

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {confettiPieces.map((piece) => (
        <motion.div
          key={piece.id}
          className="absolute w-3 h-3 rounded-sm"
          style={{
            left: `${piece.left}%`,
            backgroundColor: piece.color,
          }}
          initial={{ y: -20, opacity: 1, rotate: 0 }}
          animate={{
            y: '100vh',
            opacity: 0,
            rotate: 360 * (Math.random() > 0.5 ? 1 : -1),
          }}
          transition={{
            duration: piece.duration,
            delay: piece.delay,
            ease: 'linear',
          }}
        />
      ))}
    </div>
  )
}

export function Cauldron() {
  const [calderoState, setCalderoState] = useState<string>('q0')
  const [mensaje, setMensaje] = useState<string>('Caldero listo. Agrega ingredientes...')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [hasWon, setHasWon] = useState<boolean>(false)
  const [addedIngredients, setAddedIngredients] = useState<string[]>([])

  const isError = calderoState === 'q_error'

  const handleIngredientClick = async (ingredient: Ingredient) => {
    if (isLoading || isError || hasWon) return

    setIsLoading(true)

    try {
      const response = await fetch('http://localhost:8000/api/craft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          estado_actual: calderoState,
          ingrediente: ingredient.token,
        }),
      })

      if (!response.ok) {
        throw new Error('Error en la respuesta del servidor')
      }

      const data: CraftResponse = await response.json()

      setCalderoState(data.nuevo_estado)
      setMensaje(data.mensaje_ui)
      setAddedIngredients((prev) => [...prev, ingredient.token])

      // Check for victory
      if (data.salida === 'P') {
        setHasWon(true)
      }
    } catch (error) {
      console.error('Error al llamar a la API:', error)
      setMensaje('Error de conexion con el servidor')
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setCalderoState('q0')
    setMensaje('Caldero listo. Agrega ingredientes...')
    setHasWon(false)
    setAddedIngredients([])
  }

  const getCauldronColor = () => {
    if (hasWon) return 'text-amber-400'
    if (isError) return 'text-red-500'
    if (calderoState === 'q0') return 'text-gray-400'
    return 'text-emerald-400'
  }

  const getCauldronGlow = () => {
    if (hasWon) return 'shadow-[0_0_60px_rgba(251,191,36,0.6)]'
    if (isError) return 'shadow-[0_0_40px_rgba(239,68,68,0.5)]'
    if (calderoState !== 'q0') return 'shadow-[0_0_30px_rgba(16,185,129,0.4)]'
    return ''
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background magical particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-purple-400/30 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.3, 0.8, 0.3],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      {/* Victory confetti */}
      <AnimatePresence>{hasWon && <Confetti />}</AnimatePresence>

      {/* Title */}
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-amber-400 mb-8 text-center"
      >
        Caldero de Alquimia
      </motion.h1>

      {/* Cauldron */}
      <motion.div
        className={`relative mb-8 p-8 rounded-full bg-slate-800/50 border-2 border-slate-700 ${getCauldronGlow()} transition-shadow duration-500`}
        animate={
          isError
            ? {
                x: [0, -10, 10, -10, 10, 0],
                transition: { duration: 0.5 },
              }
            : {}
        }
      >
        <motion.div
          animate={hasWon ? { scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] } : {}}
          transition={{ duration: 0.6, repeat: hasWon ? Infinity : 0, repeatDelay: 1 }}
        >
          {hasWon ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 10 }}
            >
              <Sparkles className="w-24 h-24 text-amber-400" />
            </motion.div>
          ) : (
            <FlaskConical className={`w-24 h-24 ${getCauldronColor()} transition-colors duration-300`} />
          )}
        </motion.div>

        {/* Bubbles animation when mixing */}
        {calderoState !== 'q0' && !isError && !hasWon && (
          <div className="absolute inset-0 flex items-center justify-center">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="absolute w-3 h-3 bg-emerald-400/60 rounded-full"
                animate={{
                  y: [-20, -40],
                  x: [0, (i - 1) * 15],
                  opacity: [0.8, 0],
                  scale: [1, 0.5],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.3,
                }}
              />
            ))}
          </div>
        )}
      </motion.div>

      {/* State indicator */}
      <div className="mb-4 text-center">
        <span className="text-slate-500 text-sm">Estado: </span>
        <span
          className={`font-mono font-bold ${
            isError ? 'text-red-400' : hasWon ? 'text-amber-400' : 'text-emerald-400'
          }`}
        >
          {calderoState}
        </span>
      </div>

      {/* Message */}
      <motion.p
        key={mensaje}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`text-lg mb-8 text-center max-w-md ${
          isError ? 'text-red-400' : hasWon ? 'text-amber-400' : 'text-slate-300'
        }`}
      >
        {mensaje}
      </motion.p>

      {/* Added ingredients trail */}
      {addedIngredients.length > 0 && (
        <div className="flex gap-2 mb-6">
          {addedIngredients.map((token, idx) => {
            const ing = ingredients.find((i) => i.token === token)
            return (
              <motion.div
                key={idx}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={`w-8 h-8 rounded-full ${ing?.bgColor} ${ing?.borderColor} border flex items-center justify-center`}
              >
                <span className={`text-xs ${ing?.color}`}>{token}</span>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Ingredients */}
      <div className="flex gap-4 mb-8">
        {ingredients.map((ingredient) => (
          <motion.button
            key={ingredient.id}
            onClick={() => handleIngredientClick(ingredient)}
            disabled={isLoading || isError || hasWon}
            className={`
              relative p-6 rounded-2xl border-2 transition-all duration-200
              ${ingredient.bgColor} ${ingredient.borderColor} ${ingredient.color}
              ${isLoading || isError || hasWon ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110 cursor-pointer'}
            `}
            whileHover={!isLoading && !isError && !hasWon ? { scale: 1.1 } : {}}
            whileTap={!isLoading && !isError && !hasWon ? { scale: 0.95 } : {}}
          >
            {ingredient.icon}
            <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-slate-400 whitespace-nowrap">
              {ingredient.name}
            </span>
          </motion.button>
        ))}
      </div>

      {/* Reset button - shows on error or victory */}
      <AnimatePresence>
        {(isError || hasWon) && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            onClick={handleReset}
            className={`
              flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all
              ${
                isError
                  ? 'bg-red-500/20 border-2 border-red-500/50 text-red-400 hover:bg-red-500/30'
                  : 'bg-amber-500/20 border-2 border-amber-500/50 text-amber-400 hover:bg-amber-500/30'
              }
            `}
          >
            <RotateCcw className="w-5 h-5" />
            {isError ? 'Limpiar Caldero' : 'Jugar de Nuevo'}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Loading indicator */}
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 flex items-center justify-center bg-slate-900/50"
        >
          <div className="w-8 h-8 border-4 border-purple-400 border-t-transparent rounded-full animate-spin" />
        </motion.div>
      )}

      {/* Instructions */}
      <div className="mt-12 text-center text-slate-500 text-sm max-w-md">
        <p>Combina los ingredientes en el orden correcto para crear la pocion magica.</p>
        <p className="mt-2">
          <span className="text-blue-400">Agua</span> + <span className="text-green-400">Hierba</span> +{' '}
          <span className="text-purple-400">Cristal</span>
        </p>
      </div>
    </div>
  )
}
