---
name: Unified Campus Enterprise
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#424754'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#727785'
  outline-variant: '#c2c6d6'
  surface-tint: '#005ac2'
  primary: '#0058be'
  on-primary: '#ffffff'
  primary-container: '#2170e4'
  on-primary-container: '#fefcff'
  inverse-primary: '#adc6ff'
  secondary: '#006a61'
  on-secondary: '#ffffff'
  secondary-container: '#86f2e4'
  on-secondary-container: '#006f66'
  tertiary: '#6b38d4'
  on-tertiary: '#ffffff'
  tertiary-container: '#8455ef'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#89f5e7'
  secondary-fixed-dim: '#6bd8cb'
  on-secondary-fixed: '#00201d'
  on-secondary-fixed-variant: '#005049'
  tertiary-fixed: '#e9ddff'
  tertiary-fixed-dim: '#d0bcff'
  on-tertiary-fixed: '#23005c'
  on-tertiary-fixed-variant: '#5516be'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-hero:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  stat-counter:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
  badge-label:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter-xs: 0.25rem
  gutter-sm: 0.5rem
  gutter-md: 1rem
  gutter-lg: 1.5rem
  gutter-xl: 2rem
  margin-mobile: 1rem
  margin-tablet: 1.5rem
  margin-desktop: 2.5rem
  header-height: 4.5rem
  card-padding: 1.5rem
---

## Brand & Style
This design system governs an institutional, end-to-end higher education management, learning, and placement platform. Built for university administrators, deans, placement directors, and academic staff, the aesthetic delivers a calm, authoritative, and frictionless experience.

The design movement is **Modern Enterprise Cloud SaaS**: clean layout hygiene, ample white space, refined slate-tinted canvas structures, and vibrant ocean blue accents. Micro-surfaces feature gentle rounded contours (`rounded-xl` to `rounded-2xl`) to reduce administrative fatigue during long data entry workflows while upholding uncompromising institutional precision.

## Colors
The palette balances institutional authority with high-clarity data displays.

### Primary Spectrum
- **Primary Core (`#3B82F6`)**: Used for primary action buttons, key indicators, interactive active states, and radiant header fills.
- **Primary Light / Hover (`#60A5FA` / `#93C5FD`)**: Secondary accents, soft badges, and interactive feedback.
- **Primary Deep (`#1D4ED8` / `#1E40AF`)**: Text contrast on light blue grounds, active state presses, and icon fills.

### Surface and Canvas Architecture
- **App Background (`#F8FAFC`)**: Soft slate base reducing visual glare across 1080p+ widescreen monitors.
- **Surface Layer 1 (`#FFFFFF`)**: Pure card and modal fill with subtle slate boundaries.
- **Surface Layer 2 (`#F1F5F9`)**: Form control backplates, disabled fills, and alternate table rows.
- **Divider & Stroke (`#E2E8F0`)**: Crisp 1px structure preventing visual bleed across complex data grids.

### Functional Status & Badges
- **Success (`#10B981`)**: Positive state badges (`bg-[#DEF7EC] text-[#03543F]`).
- **Warning / Draft (`#F59E0B`)**: Pending status badges (`bg-[#FEF3C7] text-[#92400E]`).
- **Critical / Destructive (`#EF4444`)**: Deletion icons, locked statuses, and error notifications (`bg-[#FEE2E2] text-[#991B1B]`).
- **AI & Innovation Token (`#3B82F6`)**: Capsule pills representing AI credits (`bg-[#EFF6FF] text-[#1D4ED8] border-[#DBEAFE]`).

## Typography
The system employs **Plus Jakarta Sans** for headlines, section anchors, and metric numbers, imparting an approachable yet executive feel. **Inter** handles dense data tables, micro-labels, metadata lists, and form inputs for supreme legibility at compact scales.

- **Uppercase Overlines (`label-caps`)**: Uppercase, letter-spacing +0.05em, rendered in `#64748B` to introduce card metric categories without competing with primary counts.
- **Numbers & Metrics**: Rendered in 700 weight with tabular figures enabled (`font-variant-numeric: tabular-nums`) to preserve optical alignment across comparison dashboards.

## Layout & Spacing
The layout relies on a structured, fluid-responsive 12-column grid system bounded inside a max-width container of `1440px`.

### Responsive Breakpoints & Adapters
- **Desktop (≥1280px)**: 12-column grid, horizontal navigation bar, metric rows formatted in 3 or 4 columns (`grid-cols-4`), fixed table action columns.
- **Tablet (768px - 1279px)**: 8-column layout, metric stat blocks fold to 2x2 grids (`grid-cols-2`), horizontal table scrolling with pinned entity columns.
- **Mobile (<768px)**: 4-column single flow, top navigation transitions into a sheet slide-over, floating horizontal metric scroller, and cards replace nested row matrices.

### Spacing Rhythm
Vertical cadence adheres strictly to multiples of `8px` (`0.5rem`). Metric groupings and utility cards feature `1.5rem` (24px) internal clearance, with `1rem` (16px) separation between sibling modules.

## Elevation & Depth
Depth in this system avoids harsh drops, relying on diffused ambient shadows tinted with dark slate alongside 1px structural boundaries.

- **Flat Canvas (`z-0`)**: `#F8FAFC`, infinite canvas.
- **Resting Container (`z-1`)**: Pure white `#FFFFFF` surface accompanied by border `1px solid #E2E8F0` and subtle elevation `box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.05)`.
- **Raised Cards / Interactive Hover (`z-2`)**: `box-shadow: 0 10px 25px -4px rgba(15, 23, 42, 0.08), 0 4px 6px -2px rgba(15, 23, 42, 0.04)`.
- **Flyout Navigation Menus & Popovers (`z-30`)**: Floating white container with `1px solid #E2E8F0`, rounded at `1rem`, supported by soft spread shadow: `0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.05)`.
- **Banner Shading**: Feature banners (such as Faculty Management or Assessment Hubs) utilize soft linear gradients (`linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)`) with interior radial glows instead of heavy external drop shadows.

## Shapes
A roundedness tier of `2` provides a friendly, human-centric aesthetic without sacrificing administrative efficiency.

- **Standard Cards & Banners**: `1rem` (16px, `rounded-2xl`) border-radius for primary sections, dashboard banners, and summary modules.
- **Form Inputs & Search Fields**: `0.75rem` (12px, `rounded-xl`) to ensure a soft container feel.
- **Buttons & Chips**: `0.75rem` (12px) for structural buttons; fully pill-shaped (`9999px`, `rounded-full`) for context tags, status indicators, and user avatar chips.
- **Dropdown Menus**: `1rem` (16px) on menus to mirror card curvature and establish unified cohesion.

## Components

### 1. Navigation Top Bar
- **Shell**: White `#FFFFFF` sticky header with bottom hairline `1px solid #E2E8F0` and `px-8 py-3.5`.
- **Brand Cluster**: Logo badge on left paired with title and organizational subtitle in `#1E293B` and `#64748B`.
- **Center Navlinks**: Segmented link groups with down-chevrons. Active tabs receive a soft blue pill highlight (`bg-[#EFF6FF] text-[#2563EB] font-semibold`).
- **Dropdown Overlays**: Floating `rounded-2xl` cards with icon + label vertical stacks, high-contrast hover backplate (`hover:bg-[#F8FAFC] text-[#334155] hover:text-[#0F172A]`).
- **Utility Cluster**: Pill badge indicating AI Credits (`bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]` or blue variant `bg-[#EFF6FF] text-[#1D4ED8]`), bell notification button, configuration gear, and circular user profile chip with initials.

### 2. Header Hero Banners
- **Background**: Radiant sky/ocean gradient (`linear-gradient(105deg, #3B82F6 0%, #2563EB 100%)`) or light theme (`bg-gradient-to-r from-[#EFF6FF] via-[#DBEAFE] to-white`).
- **Content**: Contrast-rich headline (`#FFFFFF` on dark banner, `#0F172A` on light variant), accompanying task description, and flush-right primary action button.

### 3. Metric Stat Cards
- **Structure**: 4-column responsive grid card (`bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm`).
- **Content Hierarchy**:
  1. Top: Uppercase label in `#64748B` (`tracking-wider text-xs font-semibold`) paired with an icon housed in an inset rounded square (`bg-[#EFF6FF] text-[#3B82F6]`).
  2. Center: Large primary metric counter (`text-3xl font-bold text-[#1E293B]`).
  3. Bottom: Status badge or trend pill (`bg-[#DEF7EC] text-[#03543F] text-xs font-medium px-2.5 py-0.5 rounded-full`).

### 4. Data Tables & Data Grids
- **Header**: `#F8FAFC` background with subtle bottom border, typography configured in `label-caps` (`#64748B`).
- **Rows**: Alternating white background with hover state (`hover:bg-[#F8FAFC]`), `py-4` cell padding, and clean inline avatars or metadata columns.
- **Action Button Clusters**: Micro-action icon buttons grouped horizontally (`w-8 h-8 rounded-lg flex items-center justify-center border transition-colors`):
  - *View/Activity*: `bg-[#EFF6FF] text-[#2563EB] border-[#DBEAFE] hover:bg-[#DBEAFE]`
  - *Edit*: `bg-[#EFF6FF] text-[#2563EB] border-[#DBEAFE] hover:bg-[#DBEAFE]`
  - *Lock/Permissions*: `bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0] hover:bg-[#E2E8F0]`
  - *Delete/Deactivate*: `bg-[#FEF2F2] text-[#DC2626] border-[#FEE2E2] hover:bg-[#FEE2E2]`

### 5. Buttons & Interactive Controls
- **Primary Button**: `#3B82F6` (Hover `#2563EB`) background with white bold text, `rounded-xl`, subtle tap elevation shadow.
- **Secondary / Outlined**: `#FFFFFF` background with `1px solid #CBD5E1`, text `#334155`, hover `#F8FAFC`.
- **Destructive**: `#DC2626` background, white text.

### 6. Inputs & Search Fields
- **Search Bar**: Full-width or inline filter bar with left-aligned search icon, `rounded-xl`, `#FFFFFF` background, border `1px solid #E2E8F0`, focus ring `2px solid #93C5FD`.
- **Dropdown Filters**: Native-styled rounded select triggers with right chevron and clear selected indicators.

### 7. Empty States
- Centered layout within card containers featuring an oversized faint dual-tone icon (`w-12 h-12 text-[#94A3B8] bg-[#F1F5F9] rounded-2xl flex items-center justify-center mb-3`), bold title (`#1E293B`), and descriptive instructional text (`#64748B`).