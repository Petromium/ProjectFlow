# Design Guidelines: EPC-Focused PMIS Platform

## Design Approach

**Selected System:** Material Design 3 (Material You) adapted for enterprise productivity
**Justification:** Information-dense enterprise application requiring robust component patterns, clear hierarchy, and proven usability for complex data visualization and manipulation.

**Key Design Principles:**
1. Information clarity over decoration
2. Consistent, predictable interactions
3. Efficient space utilization for dense data
4. Professional, trustworthy aesthetic
5. Scalable component system

---

## Typography

**Font Families:**
- Primary: Inter (headings, UI labels, buttons)
- Secondary: Roboto Mono (data tables, numeric values, code)

**Type Scale:**
- Page Titles: text-3xl font-semibold (30px)
- Section Headers: text-xl font-semibold (20px)
- Subsection Headers: text-lg font-medium (18px)
- Body Text: text-base font-normal (16px)
- Table Headers: text-sm font-semibold uppercase tracking-wide (14px)
- Table Data: text-sm font-normal (14px)
- Helper Text: text-xs font-normal (12px)
- Metrics/Numbers: text-2xl font-bold tracking-tight (24px)

---

## Layout System

**Three-Panel Architecture:**

**Left Sidebar (Fixed):**
- Width: w-64 (256px) on desktop, full-width drawer on mobile
- Pinned navigation tabs with icons and labels
- Collapsible to w-16 (icon-only mode)

**Top Bar (Fixed):**
- Height: h-16 (64px)
- Left to right: Org dropdown → Project dropdown → Tab dropdown → Add+ button → Search (flex-1) → Import/Export → Theme toggle → Notifications → Profile

**Right Sidebar (Contextual):**
- Width: w-80 (320px) on desktop, slides over on tablet/mobile
- Tab-specific metrics, mini-charts, quick filters
- Collapsible to maximize center area

**Center Area (Scrollable):**
- Padding: p-6 on desktop, p-4 on mobile
- Max-width: max-w-full (utilizes available space between sidebars)

**Spacing System:**
Use Tailwind units: **2, 4, 6, 8, 12, 16** for consistent rhythm
- Component gaps: gap-4 (standard), gap-6 (sections)
- Section padding: p-6 (desktop), p-4 (mobile)
- Card padding: p-4 (compact), p-6 (spacious)
- Stack spacing: space-y-4 (list items), space-y-6 (sections)

---

## Component Library

### Core UI Elements

**Buttons:**
- Primary: Filled with elevation shadow-sm
- Secondary: Outlined with border-2
- Text: No background, underline on hover
- Icon buttons: Square (w-10 h-10), circular for FABs
- Sizes: sm (h-8 px-3), md (h-10 px-4), lg (h-12 px-6)

**Input Fields:**
- Standard height: h-10
- Border: border-2, focus ring-2 ring-offset-2
- Labels: text-sm font-medium mb-1
- Helper text: text-xs mt-1

**Dropdowns:**
- Trigger height: h-10
- Menu: rounded-lg shadow-lg border
- Items: px-4 py-2 hover background change

### Navigation

**Top Bar Dropdowns:**
- Organization/Project selectors: Searchable with hierarchy tree
- Tabs dropdown: Grouped by category (Management, Logs, Reports)
- Add+ menu: Quick actions with keyboard shortcuts displayed

**Left Sidebar:**
- Active state: Filled background, left border accent (border-l-4)
- Inactive: Transparent, subtle hover state
- Icons: w-5 h-5, aligned left with text-sm label
- Badges: Notification counts on right (rounded-full px-2 text-xs)

### Data Display

**Center Tables (Row Cards):**
- Card structure: Border, rounded-lg, shadow-sm, p-4, mb-2
- Draggable handle: Left side, 6-dot grip icon
- Checkbox: w-5 h-5, mr-4
- Content grid: grid-cols-12 for flexible column layouts
- Expand/collapse icon: Right side for nested data
- Hover: Subtle background lift, shadow-md

**Table Headers:**
- Sticky positioning: sticky top-0 z-10
- Background: Solid fill (prevents transparency issues)
- Sort indicators: Arrows, active column highlighted
- Column resize: Drag handles between headers
- Show/hide columns: Dropdown menu with checkboxes

**Gantt Chart:**
- Timeline header: Dual-row (months + weeks), sticky
- Task rows: h-12, alternating subtle backgrounds
- Task bars: Rounded, shadow, with handles for resize/drag
- Dependencies: SVG lines with arrows, curved connectors
- Grid lines: Subtle vertical lines for time units
- Zoom controls: Top-right (zoom in/out, fit to screen)

**Kanban Board:**
- Columns: min-w-80, max-w-96, vertical scroll
- Column headers: Sticky, shows count badge
- Cards: rounded-lg, shadow, p-3, mb-3
- Drag preview: Opacity-50 with shadow-xl
- Add card button: Dashed border, full width, at column bottom

**Calendar View:**
- Month grid: 7 columns (days), dynamic rows
- Day cells: Aspect-square, border
- Event chips: Truncated text, rounded-full px-2 py-1 text-xs
- Multi-day events: Span cells with connecting visual
- Today indicator: Ring border, bold date

### Forms & Modals

**Center Modals:**
- Backdrop: Semi-transparent overlay
- Modal: max-w-2xl (standard), max-w-4xl (complex forms like WBS)
- Header: Sticky, border-bottom, with close button
- Body: p-6, max-h-[70vh], overflow-y-auto
- Footer: Sticky bottom, border-top, button alignment right

**Multi-Step Forms:**
- Step indicator: Horizontal stepper at top
- Navigation: Back/Next buttons, Save Draft option
- Validation: Inline errors, summary at top for submit

**RACI Matrix Input:**
- Grid layout: Rows (team members), columns (R/A/C/I)
- Radio/checkbox selection per cell
- Visual indicators for assigned roles

### Data Visualization

**Dashboards:**
- Metric cards: Grid (grid-cols-1 md:grid-cols-2 lg:grid-cols-4)
- Card structure: p-6, rounded-xl, shadow
- Large number: text-3xl font-bold
- Label: text-sm, trend indicator (↑↓ with percentage)

**Charts:**
- Container: rounded-lg, border, p-4
- Legend: Bottom or right, responsive
- Tooltips: shadow-lg, rounded, px-3 py-2, text-sm

**Cost Analytics:**
- Comparison charts: Side-by-side bars (Budget vs Actual vs Forecast)
- Sparklines: Inline with table rows for trends
- Variance indicators: Red/green, percentage badges

### Overlays & Feedback

**Notifications (Toast):**
- Position: top-right, stacked
- Width: w-96, rounded-lg, shadow-xl, p-4
- Auto-dismiss: 5 seconds, close button
- Types: Success, Warning, Error, Info (distinct icons)

**Loading States:**
- Skeleton screens: Pulse animation for cards/tables
- Inline spinners: w-5 h-5 for buttons
- Overlay loader: Full-screen for initial data fetch

**Conflict Resolution UI:**
- Split view: grid-cols-2 (Your changes | Their changes)
- Diff highlighting: Added (green bg), removed (red bg)
- Resolution buttons: Accept theirs, Keep mine, Merge manually

---

## Animations

**Essential Only:**
- Modal enter/exit: Scale + fade (150ms)
- Dropdown open/close: Slide + fade (100ms)
- Drag feedback: Smooth transform (0ms - instant grab)
- Toast notifications: Slide in from right (200ms)
- **No decorative animations**, **no scroll-triggered effects**, **no page transitions**

---

## Responsive Behavior

**Breakpoints:**
- Mobile: < 768px - Single column, stacked layout, drawer navigation
- Tablet: 768px - 1024px - Collapsible sidebars, 2-column grids
- Desktop: > 1024px - Full three-panel layout, multi-column grids

**Mobile Adaptations:**
- Gantt: Horizontal scroll with pinned task names
- Tables: Vertical cards (stack columns)
- Modals: Full-screen on mobile
- Top bar: Hamburger menu, condensed dropdowns

---

## Images

**No hero images** - This is a data-focused enterprise application. Visual assets limited to:
- Empty state illustrations: Center of tables/lists when no data
- Onboarding graphics: Multi-step wizard illustrations
- Error state graphics: 404, offline mode, sync failed
- Avatar placeholders: User profiles, stakeholder lists
- File type icons: Document attachments

All illustrations should be simple, line-art style, professional tone.