import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

console.log('Building vanilla JS bundle with esbuild...');
execSync(
  'npx esbuild src/vanilla-main.ts --bundle --outfile=public/vanilla-bundle.js --format=esm --external:three --external:three/webgpu --external:three/tsl --external:three/examples/jsm/* --external:lil-gui',
  { stdio: 'inherit' }
);

const bundleJs = fs.readFileSync('public/vanilla-bundle.js', 'utf-8');

const codepenHtmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Earth WebGPU Engine - CodePen Standalone</title>
  
  <!-- Importmap for Three.js WebGPU, TSL, and lil-gui -->
  <script type="importmap">
    {
      "imports": {
        "three": "https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.js",
        "three/webgpu": "https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.webgpu.js",
        "three/tsl": "https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.tsl.js",
        "three/examples/jsm/": "https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/",
        "lil-gui": "https://cdn.jsdelivr.net/npm/lil-gui@0.21.0/dist/lil-gui.esm.js"
      }
    }
  </script>

  <style>
    /* Reset & Viewport */
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: #0a0a0a;
      color: #ffffff;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }

    #app {
      position: relative;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background-color: #0a0a0a;
    }

    #earth-canvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      display: block;
      touch-action: none;
    }

    /* HUD Overlay */
    #hud-container {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 20;
    }

    /* City Beacons */
    .beacon-point {
      position: absolute;
      left: 0;
      top: 0;
      transform: translate3d(0, 0, 0) translate(-50%, -50%);
      opacity: 0;
      display: none;
      pointer-events: none;
      z-index: 20;
      width: 2rem;
      height: 2rem;
      align-items: center;
      justify-content: center;
    }

    .beacon-core {
      position: relative;
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 9999px;
      border: 1px solid rgba(0, 0, 0, 0.4);
      background-color: #ffffff;
      box-shadow: 0 0 8px rgba(255, 255, 255, 0.7);
      z-index: 20;
    }

    .beacon-ping {
      position: absolute;
      width: 1.25rem;
      height: 1.25rem;
      border-radius: 9999px;
      border: 1px solid rgba(255, 255, 255, 0.5);
      background-color: rgba(255, 255, 255, 0.1);
      animation: ping-anim 3s cubic-bezier(0, 0, 0.2, 1) infinite;
    }

    .beacon-ring {
      position: absolute;
      width: 1.25rem;
      height: 1.25rem;
      border-radius: 9999px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      pointer-events: none;
    }

    @keyframes ping-anim {
      75%, 100% {
        transform: scale(2);
        opacity: 0;
      }
    }

    /* City Labels */
    .label-box {
      position: absolute;
      left: 0;
      top: 0;
      transform: translate3d(0, 0, 0);
      opacity: 0;
      display: none;
      pointer-events: none;
      z-index: 20;
      white-space: nowrap;
      user-select: none;
    }

    .label-align {
      display: flex;
      flex-direction: column;
    }

    .label-align-start {
      align-items: flex-start;
    }

    .label-align-end {
      align-items: flex-end;
    }

    .label-title {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-weight: 700;
      letter-spacing: 0.2em;
      font-size: 11px;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.8);
    }

    .label-sub {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 9px;
      color: rgba(255, 255, 255, 0.4);
      margin-top: 2px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .label-dot {
      color: rgba(255, 255, 255, 0.2);
    }

    /* Sci-Fi Loader Overlay */
    #loader {
      position: absolute;
      inset: 0;
      z-index: 50;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      pointer-events: auto;
      overflow: hidden;
      background-color: #000000;
      transition: opacity 1.2s ease-in-out, filter 1.2s ease-in-out;
    }

    .loader-bg-glow {
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at center, rgba(15, 23, 42, 0.4) 0%, rgba(0, 0, 0, 0.9) 60%, #000000 100%);
    }

    .loader-grid {
      position: absolute;
      inset: 0;
      background-image: 
        linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
      background-size: 4rem 4rem;
      mask-image: radial-gradient(ellipse 60% 60% at 50% 50%, #000 70%, transparent 100%);
      -webkit-mask-image: radial-gradient(ellipse 60% 60% at 50% 50%, #000 70%, transparent 100%);
    }

    .loader-content {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      z-index: 10;
    }

    .spinner-outer {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 8rem;
      height: 8rem;
      margin-top: -4rem;
      border-radius: 9999px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-top-color: rgba(255, 255, 255, 0.8);
      border-right-color: rgba(255, 255, 255, 0.3);
      border-bottom-color: transparent;
      border-left-color: transparent;
      animation: spin-cw 8s linear infinite;
    }

    .spinner-inner {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 10rem;
      height: 10rem;
      margin-top: -4rem;
      border-radius: 9999px;
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-bottom-color: rgba(255, 255, 255, 0.4);
      animation: spin-ccw 12s linear infinite;
    }

    @keyframes spin-cw {
      from { transform: translate(-50%, -50%) rotate(0deg); }
      to { transform: translate(-50%, -50%) rotate(360deg); }
    }

    @keyframes spin-ccw {
      from { transform: translate(-50%, -50%) rotate(0deg); }
      to { transform: translate(-50%, -50%) rotate(-360deg); }
    }

    .loader-counter {
      width: 4rem;
      height: 4rem;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 3rem;
    }

    .loader-percent {
      font-size: 1.5rem;
      font-weight: 300;
      letter-spacing: 0.1em;
      color: rgba(255, 255, 255, 0.9);
    }

    .loader-percent-symbol {
      font-size: 0.875rem;
      color: rgba(255, 255, 255, 0.4);
      margin-left: 0.25rem;
    }

    .loader-title {
      font-size: 0.75rem;
      letter-spacing: 0.3em;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.3);
      margin-bottom: 0.5rem;
    }

    .loader-message {
      font-size: 0.75rem;
      letter-spacing: 0.1em;
      color: rgba(255, 255, 255, 0.8);
      height: 1rem;
    }

    .loader-bar-bg {
      width: 16rem;
      height: 1px;
      background-color: rgba(255, 255, 255, 0.1);
      margin-top: 1.5rem;
      position: relative;
      overflow: hidden;
    }

    .loader-bar-fill {
      position: absolute;
      top: 0;
      left: 0;
      bottom: 0;
      width: 0%;
      background-color: rgba(255, 255, 255, 0.8);
      transition: width 0.2s ease-out;
    }

    .lil-gui {
      font-family: monospace !important;
      z-index: 40 !important;
    }
  </style>
</head>
<body>
  <div id="app">
    <!-- 3D WebGPU Earth Canvas -->
    <canvas id="earth-canvas"></canvas>

    <!-- City Beacons & HUD Overlay -->
    <div id="hud-container"></div>

    <!-- Sci-Fi System Boot Loader -->
    <div id="loader">
      <div class="loader-bg-glow"></div>
      <div class="loader-grid"></div>
      <div class="loader-content">
        <div class="spinner-outer"></div>
        <div class="spinner-inner"></div>
        <div class="loader-counter">
          <span class="loader-percent">
            <span id="loader-progress-val">0</span>
            <span class="loader-percent-symbol">%</span>
          </span>
        </div>
        <div class="loader-title">System Boot</div>
        <div id="loader-message-val" class="loader-message">Initializing WebGPU Renderer</div>
        <div class="loader-bar-bg">
          <div id="loader-progress-bar" class="loader-bar-fill"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- Transpiled Standalone Vanilla JS Application Engine -->
  <script type="module">
${bundleJs}
  </script>
</body>
</html>
`;

fs.writeFileSync('codepen.html', codepenHtmlContent, 'utf-8');
console.log('Successfully generated codepen.html!');
