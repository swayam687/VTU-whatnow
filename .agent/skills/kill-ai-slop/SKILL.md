---
name: kill-ai-slop
description: Detects and eliminates AI-slop design tells in web interfaces. Replaces indigo/purple gradients, glowing cards, emoji scatter, nested containers, and all-caps badges with clean editorial craft, hairline borders, paper and ink palettes, and crisp typography.
---

# Kill AI Slop — The Clean Design Playbook

Vibe-coded and machine-generated websites suffer from predictable aesthetic clichés:
- Indigo/violet gradients on black/white surfaces
- Cards nested in cards nested in cards
- Emoji scatter in every heading and pill badge (🚀, ✨, 🔥, ⚡️)
- Fuzzy glowing multi-layer box shadows and frosted-glass blur
- ALL-CAPS micro-labels with excessive letter-spacing
- Low-contrast light gray text on light colored backgrounds

## The 6 Clean Principles (Paper + Ink)

### 1. Palette: Paper & Ink + One Editorial Accent
- **Slop**: `bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500`
- **Fix**: Crisp neutral surfaces (`bg-white`, `bg-slate-50`, `bg-zinc-900`) with high-contrast ink text (`text-slate-900`, `text-zinc-950`). If an accent is needed, use exactly **one** intentional editorial tone (e.g., ink black `#09090b`, precision cobalt `#2563eb`, or proofreader vermilion `#dc2626`).

### 2. Flatten Containers (Kill Nested Cards)
- **Slop**: A card containing a section card containing a metric card containing an icon card.
- **Fix**: Use negative space, whitespace padding, and subtle hairline dividers (`border-t border-slate-200/80` or `divide-y divide-slate-100`). Let the content breathe directly on the page surface.

### 3. Iconography Over Emoji Clutter
- **Slop**: `⚡️ Fast Results` `🏆 Rank 1` `🎉 Success` `✨ AI Magic`
- **Fix**: Replace cartoon emojis with clean, geometric inline SVG icons (16px or 18px) with consistent 1.5px or 2px stroke width. Plain text with strong typographic weight is often superior to icons.

### 4. Quiet Shadows & Hairline Precision
- **Slop**: `shadow-2xl shadow-indigo-500/30` or `backdrop-blur-xl bg-white/30`
- **Fix**: Crisp hairline border `border border-slate-200/80` or subtle natural shadow `shadow-[0_1px_3px_rgba(0,0,0,0.06)]`. Remove colored glowing halos.

### 5. Typeset & Hierarchy
- **Slop**: Random mix of `uppercase text-[9px] font-black tracking-widest` alongside multiple badge colors.
- **Fix**: Clear proportional typographic scale. Primary titles (`text-2xl font-bold tracking-tight text-slate-900`), crisp supporting labels (`text-xs font-medium text-slate-500`), and tabular numbers in monospace (`font-mono font-semibold`).

### 6. Data Density & Table Craft
- **Slop**: Massive puffy cards for simple numerical records.
- **Fix**: High-density, elegant data tables or structured list rows with right-aligned numbers, clear column headers, and subtle hover highlights (`hover:bg-slate-50/70`).
