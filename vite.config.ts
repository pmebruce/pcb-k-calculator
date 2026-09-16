import vinext from "vinext";
import { defineConfig } from "vite";

const configuredBasePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");
const base = configuredBasePath ? `${configuredBasePath}/` : "/";

export default defineConfig({
  base,
  plugins: [vinext()],
});
