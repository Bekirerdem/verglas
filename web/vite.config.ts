import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // @verglas/sdk is a file: dependency carrying its own node_modules;
    // without dedupe the bundle would ship two viem copies.
    dedupe: ['viem'],
  },
})
