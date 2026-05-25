# Maataa OS Electron Shell

Offline desktop shell for the Maataa OS Vite cockpit.

## Commands

```bash
npm run electron:dev
npm run electron:build
```

The shell loads `http://127.0.0.1:1420` in development and `dist/index.html` when
`MAATAA_ELECTRON_MODE=production` is set. Navigation is restricted to local
origins and file URLs inside the repository boundary.
