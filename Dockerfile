# Usamos una versión ligera de Node.js
FROM node:22-alpine

# Establecemos el directorio de trabajo dentro del contenedor
WORKDIR /app

# Instalamos pnpm globalmente
RUN npm install -g pnpm

# Copiamos solo los archivos de dependencias primero para aprovechar el caché de Docker
COPY package.json pnpm-lock.yaml ./

# Instalamos las dependencias
RUN pnpm install

# Copiamos el resto del código fuente
COPY . .

# Exponemos el puerto de Vite
EXPOSE 5173

# Comando para iniciar el servidor de desarrollo
CMD ["pnpm", "run", "dev"]