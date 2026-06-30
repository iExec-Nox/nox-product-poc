# ADR-0011: Developer mode enabled by default, toggle removed from modals

**Status:** Accepted
**Date:** 2026-03-07

## Context

Developer mode was opt-in (off by default) and each modal (Wrap, Transfer, Selective Disclosure) had its own DevModeToggle. This added visual clutter in modals and hid the code section that is a key differentiator of the demo.

## Decision

1. Enable developer mode by default (`useDevMode` returns `true` when no localStorage key exists)
2. Remove `<DevModeToggle>` from all modals — the code section is always visible
3. Keep the global toggle in the dashboard header and mobile menu as a master switch
4. Modals still read `useDevMode()` to respect the global toggle when disabled

## Consequences

- First-time users see the code section immediately in all modals
- Users can still disable dev mode globally from the dashboard header
- Modals are visually cleaner (no toggle in header)
