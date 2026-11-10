---
name: design-taste-frontend
description: High-end web frontend craftsmanship inspired by Linear, Figma, and x.ai. Builds interfaces using direct copy, balanced column rhythm, real UI components, precise spacing, and quiet tactile micro-interactions.
---

# Design Taste Frontend (Taste Skill)

Build professional software interfaces at the caliber of Figma, Linear, and x.ai rather than generic template landings.

## Core Directives

1. **Restraint & Direct Copy**
   - Write clear, unambiguous labels: "Search by USN or Name" instead of "Embark on Your Academic Journey".
   - Avoid empty hype, promotional badges, or filler banners.

2. **Single Cohesive System**
   - Unified radius system: standard elements use `rounded-xl` (12px) or `rounded-lg` (8px). Outer cards use `rounded-2xl` (16px).
   - Uniform spacing rhythm: 4px grid (p-3 = 12px, p-4 = 16px, p-6 = 24px, gap-3, gap-4).

3. **High-Precision Data Presentation**
   - Tabular numerals (`font-mono`, `tabular-nums`) for marks, ranks, percentages, and timestamps.
   - Right-align numeric columns in tables; left-align text and names.
   - Clear visual status indicators with quiet background tints and dark text (e.g. `bg-emerald-50 text-emerald-800 border border-emerald-200/60`).

4. **Tactile Micro-Interactions**
   - Interactive buttons: subtle active press `active:scale-[0.98]` and smooth transitions (`transition-all duration-150`).
   - Focus rings: high-contrast keyboard focus outlines (`focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1`).
   - Fast, fluid, non-blocking UI state updates.
