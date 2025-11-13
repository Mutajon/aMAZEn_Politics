import type { Plugin } from 'vite';

/**
 * Vite Plugin: Prevent Auto-Reload on WebSocket Reconnect
 *
 * Problem: Vite's HMR automatically reloads the page when the WebSocket
 * reconnects after tab inactivity (1-5 minutes). This causes disruption
 * during development when switching tabs or leaving the window idle.
 *
 * Solution: This plugin injects custom client code that intercepts the
 * 'vite:ws:disconnect' event and prevents the automatic `location.reload()`
 * while preserving all other HMR functionality.
 *
 * Implementation: Vite's client code (node_modules/vite/dist/client/client.mjs:870)
 * calls location.reload() after successful WebSocket reconnection. We override
 * this behavior by intercepting the custom message handler.
 */
export function noReloadOnReconnect(): Plugin {
  return {
    name: 'no-reload-on-reconnect',

    // Inject custom client code to override Vite's reload behavior
    transformIndexHtml() {
      return [
        {
          tag: 'script',
          attrs: { type: 'module' },
          children: `
            // Override Vite's WebSocket disconnect handler to prevent auto-reload
            if (import.meta.hot) {
              const originalReload = window.location.reload.bind(window.location);
              let isViteReconnecting = false;

              // Listen for Vite's disconnect event
              import.meta.hot.on('vite:ws:disconnect', () => {
                console.log('[vite-plugin-no-reload] WebSocket disconnected, will reconnect without reload');
                isViteReconnecting = true;
              });

              // Listen for successful reconnection
              import.meta.hot.on('vite:ws:connect', () => {
                console.log('[vite-plugin-no-reload] WebSocket reconnected successfully');
                isViteReconnecting = false;
              });

              // Intercept reload calls during reconnection
              window.location.reload = function(...args) {
                if (isViteReconnecting) {
                  console.log('[vite-plugin-no-reload] Prevented automatic reload on reconnect');
                  isViteReconnecting = false;
                  return;
                }
                // Allow manual reloads and reloads for other reasons
                return originalReload(...args);
              };
            }
          `,
        },
      ];
    },
  };
}
