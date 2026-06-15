import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/item-explorer-hub-main/",
  plugins: [tsconfigPaths(), tanstackStart(), react()],
});
