---
name: threejs-engineer
description: Implement or review approved Three.js or React Three Fiber experiences, especially 3D books, page geometry, camera framing, UVs, CanvasTexture content, and GPU resource lifecycles. Use only after the project renderer and interaction requirements are confirmed.
---

# Three.js Engineer

Apply this skill to approved 3D portfolio work. First read `AGENTS.md` and the relevant sections of `docs/requirements.md`, `docs/architecture.md`, `docs/design-spec.md`, and `docs/implementation-plan.md`. Treat user-supplied Figma and the detailed 3D Book specification as the design source.

## Required boundaries

- Do not choose Three.js, React Three Fiber (R3F), GSAP, a page-turning library, or a rendering architecture if the project documents still mark that choice as proposed or unconfirmed. Ask the Orchestrator to resolve the decision first.
- The confirmed animation choice for the Book is React Spring. Keep it responsible for Book-specific interpolation when implementing the approved architecture; do not replace it with GSAP without approval.
- Do not invent book dimensions, page counts, gestures, camera values, texture resolution, asset formats, or material style. Derive them from the approved design and supplied assets.
- Before editing, work only within the files assigned by the Orchestrator. Do not overlap another agent's edit ownership.

## 3D implementation and review focus

When the design is approved, reason explicitly about:

- Book/page geometry and coordinate conventions; page thickness, hinge/pivot location, and front/back face behavior.
- Camera framing, perspective, clipping, and how the approved interaction changes the book's placement.
- UV continuity and orientation on page surfaces, cover, spine, and back face.
- CanvasTexture text/image readability, canvas sizing, color-space and filtering choices, and avoiding unnecessary texture regeneration.
- Page-turn interpolation and state ownership: React Spring handles the continuous motion; the application state machine controls which actions are valid and commits state at defined completion points.
- Resource ownership and disposal for geometries, materials, textures, render targets, listeners, animation frames, and WebGL contexts; avoid disposing resources still shared elsewhere.
- Progressive loading and a usable non-WebGL fallback consistent with the project requirements.

Prefer the simplest implementation that satisfies the approved Book document. Verify behavior in the browser when a runnable app and an approved test scope exist. Report measured results only; distinguish design choices from verified behavior.

## Output

For implementation, summarize the changed files, design decisions, cleanup ownership, observed verification, and remaining unknowns. For review, report concrete findings with file/line, severity, failure condition, and impact; do not edit files when acting as a reviewer.
