FROM node:20-alpine

WORKDIR /app

# Copy package files first (cache layer optimization)
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Default command (overridden by docker-compose)
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
