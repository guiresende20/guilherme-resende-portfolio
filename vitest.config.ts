import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    // temp/ guarda projetos-fonte não versionados (ex.: deck da Caixa) cujos
    // testes node:test não são suítes vitest — fora da varredura.
    exclude: ["**/node_modules/**", "**/dist/**", "temp/**"],
  },
});
