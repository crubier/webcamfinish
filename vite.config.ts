import { defineConfig } from 'vite'
import reactRefresh from '@vitejs/plugin-react-refresh'

// https://vitejs.dev/config/
export default defineConfig({
  base: "/webcamfinish/",
  build: {
    outDir: "docs"
  },
  plugins: [reactRefresh()]
})
