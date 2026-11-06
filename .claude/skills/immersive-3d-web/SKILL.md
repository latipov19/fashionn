---
name: immersive-3d-web
description: Design and implement optimized interactive 3D WebGL website scenes with Three.js, React Three Fiber or existing 3D tools.
---

# Immersive 3D for the Web

## Select the right integration
- Inspect project stack first. For vanilla JS, prefer Three.js directly. For an existing React project, React Three Fiber plus Drei can be appropriate. Spline embeds may fit provided assets or hosted scenes. Do not migrate frameworks for 3D.
- Justify the 3D element in the user journey: interactive product, game space, depth cue, physics-inspired interaction, scene-based story.
- Use an approved/licensed GLB/GLTF model where available. Do not claim a mesh is a faithful external product model without actual source assets.

## Scene architecture
- Specify scene graph, camera, lighting, material system, model scale and interaction before implementation.
- Prefer glTF/GLB with compressed textures, geometry optimization, compatible texture formats and sensible pixel ratio caps.
- Load models asynchronously with progress/placeholder, error fallback and non-WebGL fallback poster or CSS illustration.
- Dispose textures, geometries, materials and listeners when a scene is torn down. Pause or reduce rendering when invisible.
- If not animating, use demand-driven rendering. Avoid per-frame application state updates and repeated allocations in render loops.
- Test pointer/touch events, camera bounds, clipping, color management and resize handling.

## Motion and comfort
- Use graceful camera transitions, subtle hover/parallax, smooth scroll-linked narratives only when they support comprehension.
- Avoid aggressive auto-rotation, sudden flashes, forced scroll hijacking or blocking overlays.
- For reduced-motion settings, disable nonessential movement and preserve access to content and controls.

## Performance budget
- Prioritize user-perceived load: defer noncritical scene init, keep initial JS cost low, choose smaller assets, prefer instancing/shared geometries, avoid excessive lights and postprocessing.
- Benchmark on actual hardware if available. Compare FPS, interaction latency and load behavior before and after optimization; never invent numbers.
- Offer a lightweight non-3D mode on constrained devices without treating all mobile devices as weak.

## Acceptance
Document input assets, actual model sources/license, implemented interactions, fallbacks, measured behavior and outstanding device/browser checks.
