import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/item-explorer-hub-main/",
  plugins: [react()],
});
