# Onyx Flux

A minimal Next.js app that renders the Onyx WebGPU shader as a full-page canvas.

## Run it

```bash
cd /Users/dillon/Projects/onyx
npm install
npm run dev
```

Then open `http://localhost:3000` in a WebGPU-capable browser.

## Files

- `app/layout.js`: app shell
- `app/page.js`: route entrypoint
- `app/main.js`: client WebGPU canvas and embedded WGSL shader
- `app/globals.css`: page-level styles
