---
name: performance-accessibility
description: Audit and improve loading speed, mobile performance, accessibility, usability and 3D resilience on real web projects.
---

# Performance & Accessibility Audit

## Baseline first
- Identify core user flows and measure what the available tooling can actually measure. Never manufacture Lighthouse scores, FPS or Core Web Vitals.
- Prioritize catastrophic bugs, accessibility blockers and initial-load regressions before decorative refinements.

## Performance priorities
- Avoid unnecessary JS dependencies and render-blocking resources. Use code splitting and dynamic imports for noncritical scenes.
- Compress/responsive-load images, manage font loading, cache sensible assets, preconnect selectively, and avoid overfetching.
- For 3D: limit draw calls, geometry/texture size, effects, pixel ratio and continuous rendering; test a graceful fallback.
- Reduce main-thread blocking, layout thrashing and oversized DOM trees. Preserve perceived responsiveness of clicks and scroll.

## Accessibility review
- Semantic navigation, headings, landmarks, forms, live updates and alternative content.
- Keyboard-only navigation, visible focus, logical tab order, correct dialog handling and target sizes.
- Meaningful labels and alt text, readable contrast and text sizing, responsive zoom, good error messages.
- Implement prefers-reduced-motion without removing content or function. Avoid flashes or aggressive movement.
- Interactive 3D must provide a usable 2D/text alternative for essential content.

## Report
Return: observed issue, severity, file/location, impact, remedy and verification status. Distinguish measured outcomes from expectations. Show before/after measurements only when actually observed.
