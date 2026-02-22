# Phase 6: Demo Scenes - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Four canonical demos (stacking boxes, bouncing balls, Newton's cradle, ragdoll) that validate the full engine stack and serve as both integration tests and library showcase. All run in a browser via Vite dev server with interactive mouse dragging. No new engine features — demos use existing API only.

</domain>

<decisions>
## Implementation Decisions

### Demo page layout
- Single HTML page with tab/selector to switch between demos — only one demo active at a time
- Fixed-size canvas (e.g., 800x600) centered on page with margins
- Minimal title + clean UI — project name as header, clean tab bar
- Dark theme — dark background, light text, bodies pop against dark canvas

### Scene composition
- Stacking boxes: exactly 10 boxes stacked on static ground
- Bouncing balls: staggered drop — balls drop one at a time with short delays to observe individual restitution differences
- Newton's cradle: 5 balls (classic configuration)
- Ragdoll: 2-3 ragdolls in the scene, showing constraint system under load

### Mouse interaction
- Click directly on a body to grab it — must click on the shape, no radius search
- Visual feedback: both a line from grab point to cursor AND body highlight during drag
- No cursor change when hovering over grabbable bodies
- Claude's discretion on whether static bodies are draggable

### Demo controls
- Each demo has: Reset scene button, Debug toggle button, Pause/Play button
- Minimal per-demo tweakable parameters (e.g., gravity slider for stacking, restitution for bouncing balls)
- Controls positioned in a sidebar panel to the right of the canvas
- Controls styled to match the dark theme — custom-styled buttons and sliders, polished look

### Claude's Discretion
- Exact canvas dimensions and scale (pixels per meter)
- Tab/selector UI implementation details
- Which specific parameters are tweakable per demo
- Whether static bodies can be dragged
- Ragdoll body segment layout and proportions
- Newton's cradle pendulum length and spacing
- Stacking box sizes and arrangement

</decisions>

<specifics>
## Specific Ideas

- The page should feel like a polished physics engine showcase — dark theme with clean UI, not a raw test page
- Staggered ball drops make it easy to see how different restitution values produce different bounce heights
- Mouse drag feedback (line + highlight) makes the interaction feel physical and connected

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-demo-scenes*
*Context gathered: 2026-02-22*
