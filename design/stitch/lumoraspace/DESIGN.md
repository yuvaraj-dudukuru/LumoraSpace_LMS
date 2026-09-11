---
name: LumoraSpace
colors:
  surface: '#fef7ff'
  surface-dim: '#ded8e0'
  surface-bright: '#fef7ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f8f1f9'
  surface-container: '#f2ecf3'
  surface-container-high: '#ede6ee'
  surface-container-highest: '#e7e0e8'
  on-surface: '#1d1b20'
  on-surface-variant: '#464555'
  inverse-surface: '#322f35'
  inverse-on-surface: '#f5eff6'
  outline: '#777587'
  outline-variant: '#c7c4d8'
  surface-tint: '#4d44e3'
  primary: '#3525cd'
  on-primary: '#ffffff'
  primary-container: '#4f46e5'
  on-primary-container: '#dad7ff'
  inverse-primary: '#c3c0ff'
  secondary: '#6340cb'
  on-secondary: '#ffffff'
  secondary-container: '#7c5ce6'
  on-secondary-container: '#fffbff'
  tertiary: '#0031cb'
  on-tertiary: '#ffffff'
  tertiary-container: '#1d48f8'
  on-tertiary-container: '#d5d9ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#0f0069'
  on-primary-fixed-variant: '#3323cc'
  secondary-fixed: '#e7deff'
  secondary-fixed-dim: '#ccbdff'
  on-secondary-fixed: '#1f0060'
  on-secondary-fixed-variant: '#4d25b5'
  tertiary-fixed: '#dee0ff'
  tertiary-fixed-dim: '#bac3ff'
  on-tertiary-fixed: '#00115a'
  on-tertiary-fixed-variant: '#0030c7'
  background: '#fef7ff'
  on-background: '#1d1b20'
  surface-variant: '#e7e0e8'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  title-lg:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  3xl: 64px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
---

## Brand & Style

The design system is rooted in **Corporate Modernism** with a heavy emphasis on **Minimalism**. The aesthetic is engineered to feel like a high-end technical tool rather than a traditional classroom, prioritizing focus, clarity, and intellectual rigor. It targets professionals and technical learners who value efficiency and depth.

The UI avoids decorative distractions ("blobs") and gamified elements (badges, heavy illustrations) in favor of a "UX-first" approach. Intelligence is conveyed through precise alignment, generous whitespace, and a sophisticated typographic hierarchy. The emotional response is one of calm confidence—the interface should feel like a quiet, well-lit library for the digital age.

## Colors

The palette is anchored by a deep Indigo primary that signals stability and technical expertise. The secondary Violet and Blue are used for categorization and distinct learning paths. 

- **Primary & States:** Use #4F46E5 for primary actions. Shift to #4338CA for hover and #3730A3 for pressed states.
- **Brand Gradient:** Reserved exclusively for high-value moments such as completion certificates, achievement highlights, or premium tier calls-to-action. It should never be used for standard UI components like buttons or navigation.
- **Neutrals:** The background scale transitions from Gray 50 (#F8F7FA) to Gray 950 (#0D0B10). Use neutrals to create distinct content zones without relying on heavy shadows.
- **Functional Colors:** Use standard semantic reds and greens for errors and success, but keep them desaturated to maintain the calm professional tone.

## Typography

This design system utilizes **Inter** across all levels to ensure a systematic and utilitarian feel. The focus is on readability and clear information scaffolding.

- **Headlines:** Use tight letter-spacing (-0.01em to -0.02em) for larger sizes to maintain a compact, premium feel. 
- **Body Text:** Standard body text uses a generous 1.5x line height to prevent reader fatigue during long-form technical lessons.
- **Labels:** Use `label-sm` with slightly increased letter spacing and uppercase styling for metadata, breadcrumbs, and section headers to create a clear visual distinction from body content.
- **Weight Usage:** Reserve Bold (700) for displays only. Use Semi-Bold (600) for headlines and Medium (500) for interactive elements like buttons and navigation items.

## Layout & Spacing

The layout philosophy follows a **Fixed Grid** on desktop and a **Fluid Grid** on mobile devices.

- **Desktop:** 12-column grid with a 1280px max-width. Use 24px gutters.
- **Tablet:** 8-column grid with 24px margins.
- **Mobile:** 4-column grid with 16px margins.
- **Spacing Logic:** All spacing must be a multiple of the 4px base unit. Use `xl` (32px) and `2xl` (48px) to separate major content sections to maintain the "high whitespace" brand promise.
- **Vertical Rhythm:** Group related elements (e.g., a label and its input) using `sm` (8px) and separate distinct groups using `lg` (24px).

## Elevation & Depth

This design system avoids heavy shadows, instead using **Low-contrast outlines** and **Tonal layers** to establish hierarchy.

- **Surface Tiers:** Use the neutral palette to create depth. Level 0 is the background (Gray 50), Level 1 is the primary content card (White), and Level 2 is for overlays or dropdowns.
- **Borders:** Define depth through 1px borders using Gray 200 for subtle separation and Gray 300 for interactive elements.
- **Shadows:** When necessary for functional depth (like a floating navigation bar or a modal), use a single, highly diffused ambient shadow: `0 4px 20px rgba(13, 11, 16, 0.05)`. It should be almost imperceptible.
- **Interactive State:** On hover, instead of a larger shadow, prefer a subtle border color shift or a slight background tint.

## Shapes

The shape language is professional and restrained. Rounded corners are used to keep the system approachable, but are kept within a tight range to maintain a technical, "engineered" look.

- **Base Radius:** 8px (`rounded`) for buttons, input fields, and small components.
- **Large Radius:** 16px (`rounded-xl`) for main content cards and containers.
- **Small Radius:** 6px for tags, chips, and checkboxes.
- **Exceptions:** No 100% circular "pill" shapes are used except for notification pips or status dots.

## Components

- **Buttons:** Primary buttons use the primary color with white text. Ghost buttons use a Gray 200 border. Content should be Medium weight, 14px or 16px.
- **Input Fields:** Use 1px Gray 300 borders with 8px radius. Focus states use a 2px primary color border or a subtle 4px outer glow with 10% opacity of the primary color.
- **Cards:** No shadows. Use 1px Gray 200 borders and 16px radius. Padding should be generous (24px or 32px) to support the high-whitespace aesthetic.
- **Lists:** Technical curriculum lists should use subtle Gray 100 dividers between items. Use professional outline icons (20px) to denote lesson types (video, document, quiz).
- **Chips/Tags:** Small (12px) text, Semi-bold, with a light gray background (Gray 100). Avoid bright colors for tags unless they represent a specific status (e.g., "In Progress" in Blue).
- **Navigation:** Top-tier navigation should be clean with no background, using Gray 600 text that shifts to Gray 950 on active/hover. No underline decorations; use a 2px bottom border on the active item only.
- **Icons:** Use a consistent 1.5pt or 2pt stroke weight for all icons. Avoid filled icons unless they represent a primary active state.