/// <reference types="node" />

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import os from "os";
import { noReloadOnReconnect } from "./vite-plugin-no-reload";

// Narrow the NIC type so TS doesn't infer `never`
type NIC = { address: string; family: string | number; internal: boolean };

function getLANIP() {
  try {
    const nets = os.networkInterfaces() as Record<string, NIC[] | undefined>;
    for (const key of Object.keys(nets)) {
      const arr = nets[key] || [];
      for (const net of arr) {
        const fam = net.family;
        const isV4 = fam === "IPv4" || fam === 4;
        if (isV4 && !net.internal) return net.address;
      }
    }
  } catch {}
  return "localhost";
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.VITE_API_BASE || "http://localhost:8787"; // Express server
  const lan = getLANIP();

  console.log(`\n[dev] API proxy → ${target}`);
  console.log(`[dev] Open on phone: http://${lan}:5173\n`);

  return {
    plugins: [react(), noReloadOnReconnect()],
    server: {
      host: true,     // expose to LAN
      port: 5173,
      strictPort: true,
      hmr: {
        host: lan,
        port: 5173,
        protocol: "ws",
      },
      proxy: {
        "/api": {
          target,
          changeOrigin: true,
        },
      },
    },
  };
});
