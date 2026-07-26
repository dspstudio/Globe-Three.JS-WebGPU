# AGENTS.md - Project Guidelines & Skill Rules for Three.js & React

This document defines coding patterns, rules, and best practices for developing Three.js (TSL / WebGPURenderer) applications within React in this workspace.

---

## 1. Architecture Overview
- **Engine Framework**: Three.js `WebGPURenderer` using TSL (Three.js Shading Language) nodes (`three/tsl` and `three/webgpu`).
- **React Integration**: `/src/components/EarthCanvas.tsx` mounts `/src/engine/Engine.ts` inside a responsive DOM `ref`. Canvas sizing uses container-aware resize listeners rather than `window.innerWidth`.
- **UI & Controls**: `lil-gui` overlay for real-time parameter tweaking, backed by `/src/engine/GUIBuilder.ts`.

---

## 2. Three.js & TSL (Node Material) Guidelines
1. **Reactive Uniforms**:
   - Prefer updating node `uniform(...)` values in `onChange` handlers over rebuilding materials or shaders.
2. **RenderPipeline & Post-Processing**:
   - When modifying `renderPipeline.outputNode` or tone mapping pipelines, set `renderPipeline.needsUpdate = true` and call `renderer.compileAsync(scene, camera)` if necessary.
3. **Tone Mapping & Color Management**:
   - Ensure select dropdowns for numeric constants (e.g. `THREE.ACESFilmicToneMapping`) explicitly parse numeric values (`Number(v)`) to avoid string mismatch issues.

---

## 3. UI & Styling Rules
1. **lil-gui Dropdown Visibility**:
   - Ensure `.lil-gui select option` has explicit background and text color variables defined in CSS to remain readable across all system dark/light themes.
2. **React Component Lifecycle**:
   - Clean up Three.js scene graphs, renderers, and GUI instances inside React `useEffect` cleanup callbacks to prevent memory leaks during HMR or unmounting.
