import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// VITE_BASE sets the path the app is served from, e.g. "/moonrise/" on GitHub Pages
// (https://<user>.github.io/moonrise/). Defaults to "/" for local dev and other hosts.
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
})
