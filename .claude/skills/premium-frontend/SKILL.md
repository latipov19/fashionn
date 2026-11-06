---
name: premium-frontend
description: Implement responsive, polished, real frontend components and pages in the project's existing framework without generic UI shortcuts.
---

# Premium Frontend Engineering

## Before changing code
- Read current app entry points, routing, styling, state management, packages, and existing user journeys.
- Reuse current stack and conventions. Plain HTML/CSS/JS is valid; so are React/Vue/Svelte if already present. Never introduce a framework without explicit project need.
- Identify design tokens and existing components. Avoid code duplication and style collisions.

## Build discipline
- Use semantic landmarks, well-structured components, reliable state transitions, accessible names, focus management, and proper input validation.
- Keep content, decoration, interaction and data loading separate enough to test.
- Implement real routes and actions, not dead buttons; include loading/empty/error/success states.
- Use modern responsive CSS with fluid sizing, container-aware composition when useful, and robust small-viewport overflow handling.
- Prefer CSS transforms/opacity for cheap animation and lazy-load heavy noncritical assets.
- Match visual polish across 360px mobile, tablet, and desktop. Avoid fixed heights that clip content.
- Follow existing lint/type/build conventions; do not hide failing checks.

## Interaction craft
- Feedback for click, drag, keyboard, touch, async submission and error handling must be obvious.
- Use deliberate transition durations, easing and hierarchy; don't add animation merely to showcase a library.
- Provide proper fallback where interactive or 3D content cannot render.
- Respect prefers-reduced-motion and visible keyboard focus.

## Delivery
Explain files changed, the user-visible behavior, checks run, and anything not verified. Prefer small, reversible changes over broad rewrites.
