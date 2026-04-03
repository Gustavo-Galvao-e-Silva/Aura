import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    // Allows your specific hostname
    allowedHosts: ['laptop-nixos'], 
    
    // NOTE: If you are running this inside Docker (which it looks like 
    // you might be based on your project files), you usually also need 
    // to expose the host so it listens on all network interfaces:
    host: true, 
  }
})
