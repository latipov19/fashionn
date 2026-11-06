---
name: visual-qa-review
description: Perform systematic pixel polish, responsive QA, functional review and cross-discipline senior-style code review before shipping.
---

# Visual & Functional QA Review

## Review passes
1. **First impression:** distinctive concept, clear headline, primary CTA, coherence, content hierarchy.
2. **Visual:** typography, alignment, margins, rhythm, overlays, shadows, contrast, icon consistency and content density.
3. **Responsive:** 360px, 768px, 1024px and desktop when possible; check clipped text, horizontal overflow and touch targets.
4. **Functional:** menus, links, form validation, error/success, navigation, loading, empty states, authentication and real-time flows.
5. **Accessibility:** keyboard, focus, semantics, reduced-motion, alternative for 3D, readable labels.
6. **Engineering:** console errors, resource failures, type/build/lint/test output, code organization, lifecycle leaks, security risks.
7. **3D and animation:** initial scene loading, resize, frame stability, memory disposal, camera bounds and fallbacks.

## Evidence rules
- Use available browser/screenshot automation to inspect actual rendering and test actions; do not claim visual QA from code reading alone.
- If browser tooling is unavailable, state the limitation and provide a concrete manual verification checklist.
- Fix blockers and high-severity issues before adding more polish. Re-run tests after each meaningful change.
- Cite file paths and explain whether issues are fixed, remaining or unverified. No fake numerical scores or unearned "production-ready" claims.

## Final review format
- **Passed:** verified checks only.
- **Fixed:** changes made with file paths.
- **Remaining:** priority-ranked items.
- **Unverified:** browser/devices or systems not directly tested.
