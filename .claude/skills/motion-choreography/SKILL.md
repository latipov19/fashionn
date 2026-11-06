---
name: motion-choreography
description: Build intentional high-impact scroll animation, microinteractions and cinematic transitions using CSS, GSAP or existing motion tools.
---

# Motion Choreography

## Direction
- Define a motion story: entrance, reveal, exploration, interaction, completion. Every animation needs a reason and clear hierarchy.
- Focus on one signature movement and polished microinteractions instead of saturating the interface with effects.
- Choose the simplest capable tool: CSS transitions/keyframes first; GSAP/ScrollTrigger for complex timelines and scroll orchestration; Motion if already used in the project.

## Implementation rules
- Prefer transforms and opacity; avoid repeatedly animating layout properties where a composited alternative exists.
- Scope animations to mounted components, clean up timelines/listeners/observers on unmount, and prevent duplicate triggers after navigation.
- Use ScrollTrigger matchMedia or equivalent for breakpoint-specific choreography. Recalculate on layout/content changes where needed.
- Provide accessible controls: don't hide critical content behind animation and don't depend on hover alone.
- Respect prefers-reduced-motion: suppress parallax, long entrances and nonessential 3D/camera movement; show fully readable static states.
- Prevent scroll traps, layout shifts, blocked pointer events, and focus being sent offscreen.

## Validation
- Confirm interactions with pointer, touch, keyboard and reduced-motion preference where tooling allows.
- Check first load, refresh, navigation back, interrupted animation and viewport resize.
- Explain any third-party animation package and its bundle/performance cost.
