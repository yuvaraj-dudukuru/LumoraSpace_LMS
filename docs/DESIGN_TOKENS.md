# Design Tokens

Source of truth: `lumoraspace/DESIGN.md` (checked into the export) plus the `tailwind.config` block embedded in every screen's `code.html` — the two agree exactly, so DESIGN.md is the canonical, de-duplicated version used below. Design system name: **LumoraSpace** — "Corporate Modernism" / high-end technical tool, not a gamified classroom.

## Brand & style summary

- Aesthetic: minimal, high-whitespace, calm-confidence "quiet library for the digital age." No decorative blobs, no heavy gamification/illustration.
- Primary color communicates technical stability; secondary/tertiary distinguish categories and learning paths.
- Brand gradient (indigo → violet/blue) is reserved for high-value moments only: certificates, achievement highlights, premium CTAs. Never used for standard buttons/nav.
- Depth comes from tonal surface layers and 1px outlines, not shadows. One diffused ambient shadow (`0 4px 20px rgba(13,11,16,0.05)`) for floating nav/modals only.

## Color palette

All values are Material-Design-3-style semantic tokens (surface/on-surface/container pairs), already used verbatim as Tailwind color keys across every screen.

| Token | Hex | Usage |
|---|---|---|
| `primary` | `#3525cd` | Primary actions, active nav, brand accent |
| `on-primary` | `#ffffff` | Text/icons on primary |
| `primary-container` | `#4f46e5` | Active nav background, primary buttons (brand blue-violet) |
| `on-primary-container` | `#dad7ff` | Text on primary-container |
| `inverse-primary` | `#c3c0ff` | Primary color on inverse (dark) surfaces |
| `primary-fixed` / `primary-fixed-dim` | `#e2dfff` / `#c3c0ff` | Fixed-tone primary surfaces (badges, chips) |
| `on-primary-fixed` / `on-primary-fixed-variant` | `#0f0069` / `#3323cc` | Text on primary-fixed surfaces |
| `secondary` | `#6340cb` | Secondary category accents |
| `on-secondary` | `#ffffff` | Text on secondary |
| `secondary-container` | `#7c5ce6` | Secondary badges/tags |
| `on-secondary-container` | `#fffbff` | Text on secondary-container |
| `secondary-fixed` / `secondary-fixed-dim` | `#e7deff` / `#ccbdff` | Fixed-tone secondary surfaces |
| `on-secondary-fixed` / `on-secondary-fixed-variant` | `#1f0060` / `#4d25b5` | Text on secondary-fixed |
| `tertiary` | `#0031cb` | Tertiary category accent (e.g. "Completed" series in charts) |
| `on-tertiary` | `#ffffff` | Text on tertiary |
| `tertiary-container` | `#1d48f8` | Tertiary badges |
| `on-tertiary-container` | `#d5d9ff` | Text on tertiary-container |
| `tertiary-fixed` / `tertiary-fixed-dim` | `#dee0ff` / `#bac3ff` | Fixed-tone tertiary (e.g. "Published" status pill) |
| `on-tertiary-fixed` / `on-tertiary-fixed-variant` | `#00115a` / `#0030c7` | Text on tertiary-fixed |
| `error` | `#ba1a1a` | Destructive actions, error states, "needs attention" |
| `on-error` | `#ffffff` | Text on error |
| `error-container` | `#ffdad6` | Error banners/badges |
| `on-error-container` | `#93000a` | Text on error-container |
| `surface` / `background` | `#fef7ff` | App background |
| `on-surface` / `on-background` | `#1d1b20` | Primary text |
| `on-surface-variant` | `#464555` | Secondary/muted text |
| `surface-dim` | `#ded8e0` | Dimmed surface |
| `surface-bright` | `#fef7ff` | Brightest surface (= surface) |
| `surface-container-lowest` | `#ffffff` | Cards on top of a tinted page background |
| `surface-container-low` | `#f8f1f9` | Sidebar / low-emphasis containers |
| `surface-container` | `#f2ecf3` | Default container fill |
| `surface-container-high` | `#ede6ee` | Hover state fill |
| `surface-container-highest` | `#e7e0e8` | Highest-emphasis container |
| `surface-variant` | `#e7e0e8` | Track backgrounds (progress bars), chip fill |
| `outline` | `#777587` | Default borders |
| `outline-variant` | `#c7c4d8` | Subtle dividers |
| `inverse-surface` | `#322f35` | Tooltips / inverse surfaces |
| `inverse-on-surface` | `#f5eff6` | Text on inverse-surface |
| `surface-tint` | `#4d44e3` | Elevation tint overlay |

Functional (non-token, used inline in a few screens for finer status granularity): success `#1e8e3e` / `#166534` on `#e6f4ea` / `#dcfce7`; warning `#ca8a04`; destructive-soft `#991b1b` on `#fee2e2`. These should be formalized as `success` / `warning` semantic tokens in the app (see OPEN_QUESTIONS.md) rather than kept as ad-hoc hex values.

## Typography

Single family — **Inter** — across every level; Material Symbols Outlined for all icons (1.5–2pt stroke weight, outlined not filled unless indicating a primary active state).

| Token | Size | Line height | Weight | Letter spacing | Use |
|---|---|---|---|---|---|
| `display-lg` | 48px | 56px | 700 | -0.02em | Largest desktop headline |
| `display-lg-mobile` | 36px | 44px | 700 | -0.02em | Largest mobile headline / big stat numbers |
| `headline-lg` | 32px | 40px | 600 | -0.01em | Page titles |
| `headline-md` | 24px | 32px | 600 | -0.01em | Section titles |
| `title-lg` | 20px | 28px | 500 | — | Card/panel titles |
| `body-lg` | 18px | 28px | 400 | — | Emphasized body copy |
| `body-md` | 16px | 24px | 400 | — | Default body text (1.5× line height) |
| `label-md` | 14px | 20px | 500 | 0.01em | Nav items, buttons, form labels |
| `label-sm` | 12px | 16px | 600 | — | Metadata, breadcrumbs, uppercase section headers |

Rules: bold (700) reserved for displays; semi-bold (600) for headlines; medium (500) for interactive elements. Tight letter-spacing (-0.01 to -0.02em) on large sizes. `label-sm` gets uppercase + wider tracking when used as metadata/breadcrumb.

## Spacing

4px base unit; all spacing must be a multiple of it.

| Token | Value |
|---|---|
| `unit` | 4px |
| `xs` | 4px |
| `sm` | 8px |
| `md` | 16px |
| `lg` | 24px |
| `xl` | 32px |
| `2xl` | 48px |
| `3xl` | 64px |
| `gutter` | 24px |
| `container-max` | 1280px |
| `margin-mobile` | 16px |

Layout: 12-column / 1280px-max fixed grid on desktop with 24px gutters; 8-column / 24px-margin on tablet; 4-column / 16px-margin fluid grid on mobile. Vertical rhythm: `sm` (8px) between a label and its input, `lg` (24px) between distinct groups, `xl`/`2xl` between major sections.

## Radii

| Token | Value | Use |
|---|---|---|
| `sm` | 0.25rem (4px) | Tags, chips, checkboxes |
| `DEFAULT` | 0.5rem (8px) | Buttons, input fields, small components |
| `md` | 0.75rem (12px) | — |
| `lg` | 1rem (16px) | Main content cards, containers |
| `xl` | 1.5rem (24px) | Large feature cards |
| `full` | 9999px | Avatars, status dots, pills — no other fully-circular "pill" shapes are used |

## Elevation & borders

- No heavy shadows anywhere. Depth = tonal surface layers (Level 0 background → Level 1 white card → Level 2 overlay/dropdown) + 1px outlines.
- Card border: 1px `outline-variant` (or Gray 200 equivalent), 16px radius (`lg`), generous 24–32px padding.
- Interactive border: Gray 300 / `outline` equivalent.
- The one allowed shadow, for floating nav or modals only: `0 4px 20px rgba(13, 11, 16, 0.05)`.
- Hover state prefers a border-color shift or subtle background tint over a bigger shadow.

## Component conventions

- **Buttons**: primary = `primary` bg + `on-primary` text; ghost = `outline-variant` border, transparent fill. Label text `label-md`, medium weight.
- **Inputs**: 1px `outline`/border, 8px radius; focus = 2px primary border or 4px primary glow at 10% opacity.
- **Cards**: no shadow, 1px `outline-variant` border, 16px radius, 24–32px padding.
- **Lists**: `outline-variant`/Gray-100 dividers between items; 20px outline icons denote item type (video/document/quiz).
- **Chips/tags**: 12px semi-bold text on `surface-variant`/Gray-100 fill; bright/status colors reserved for meaningful state (e.g. "In Progress" in blue).
- **Nav**: no background on top-level items, `on-surface-variant` text → `on-surface` on hover/active, active item gets a 2px bottom border (no underline decoration).
- **Icons**: Material Symbols Outlined, 1.5–2pt stroke, outlined by default.

## Tailwind v4 `@theme` block

Ready to paste into the app's global CSS (adjust `--font-sans` if a different fallback stack is desired).

```css
@theme {
  /* color */
  --color-primary: #3525cd;
  --color-on-primary: #ffffff;
  --color-primary-container: #4f46e5;
  --color-on-primary-container: #dad7ff;
  --color-inverse-primary: #c3c0ff;
  --color-primary-fixed: #e2dfff;
  --color-primary-fixed-dim: #c3c0ff;
  --color-on-primary-fixed: #0f0069;
  --color-on-primary-fixed-variant: #3323cc;

  --color-secondary: #6340cb;
  --color-on-secondary: #ffffff;
  --color-secondary-container: #7c5ce6;
  --color-on-secondary-container: #fffbff;
  --color-secondary-fixed: #e7deff;
  --color-secondary-fixed-dim: #ccbdff;
  --color-on-secondary-fixed: #1f0060;
  --color-on-secondary-fixed-variant: #4d25b5;

  --color-tertiary: #0031cb;
  --color-on-tertiary: #ffffff;
  --color-tertiary-container: #1d48f8;
  --color-on-tertiary-container: #d5d9ff;
  --color-tertiary-fixed: #dee0ff;
  --color-tertiary-fixed-dim: #bac3ff;
  --color-on-tertiary-fixed: #00115a;
  --color-on-tertiary-fixed-variant: #0030c7;

  --color-error: #ba1a1a;
  --color-on-error: #ffffff;
  --color-error-container: #ffdad6;
  --color-on-error-container: #93000a;

  --color-background: #fef7ff;
  --color-on-background: #1d1b20;
  --color-surface: #fef7ff;
  --color-on-surface: #1d1b20;
  --color-on-surface-variant: #464555;
  --color-surface-dim: #ded8e0;
  --color-surface-bright: #fef7ff;
  --color-surface-container-lowest: #ffffff;
  --color-surface-container-low: #f8f1f9;
  --color-surface-container: #f2ecf3;
  --color-surface-container-high: #ede6ee;
  --color-surface-container-highest: #e7e0e8;
  --color-surface-variant: #e7e0e8;
  --color-surface-tint: #4d44e3;

  --color-outline: #777587;
  --color-outline-variant: #c7c4d8;
  --color-inverse-surface: #322f35;
  --color-inverse-on-surface: #f5eff6;

  /* semantic (not in Stitch export — added for app use, see OPEN_QUESTIONS.md) */
  --color-success: #1e8e3e;
  --color-success-container: #e6f4ea;
  --color-warning: #ca8a04;
  --color-warning-container: #fef3c7;

  /* radius */
  --radius-sm: 0.25rem;
  --radius-DEFAULT: 0.5rem;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;
  --radius-xl: 1.5rem;
  --radius-full: 9999px;

  /* spacing (extends default scale) */
  --spacing-unit: 4px;
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --spacing-2xl: 48px;
  --spacing-3xl: 64px;
  --spacing-gutter: 24px;
  --spacing-margin-mobile: 16px;
  --spacing-container-max: 1280px;

  /* typography */
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;

  --text-display-lg: 48px;
  --text-display-lg--line-height: 56px;
  --text-display-lg--letter-spacing: -0.02em;
  --text-display-lg--font-weight: 700;

  --text-display-lg-mobile: 36px;
  --text-display-lg-mobile--line-height: 44px;
  --text-display-lg-mobile--letter-spacing: -0.02em;
  --text-display-lg-mobile--font-weight: 700;

  --text-headline-lg: 32px;
  --text-headline-lg--line-height: 40px;
  --text-headline-lg--letter-spacing: -0.01em;
  --text-headline-lg--font-weight: 600;

  --text-headline-md: 24px;
  --text-headline-md--line-height: 32px;
  --text-headline-md--letter-spacing: -0.01em;
  --text-headline-md--font-weight: 600;

  --text-title-lg: 20px;
  --text-title-lg--line-height: 28px;
  --text-title-lg--font-weight: 500;

  --text-body-lg: 18px;
  --text-body-lg--line-height: 28px;
  --text-body-lg--font-weight: 400;

  --text-body-md: 16px;
  --text-body-md--line-height: 24px;
  --text-body-md--font-weight: 400;

  --text-label-md: 14px;
  --text-label-md--line-height: 20px;
  --text-label-md--letter-spacing: 0.01em;
  --text-label-md--font-weight: 500;

  --text-label-sm: 12px;
  --text-label-sm--line-height: 16px;
  --text-label-sm--font-weight: 600;
}
```
