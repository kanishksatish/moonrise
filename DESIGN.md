# Moonrise visual direction

A quiet observatory for an evening together. Midnight blue, warm ivory, a restrained copper horizon, serif display type and clear system-font controls. The user's primary action is starting the routine; detailed weather sits behind an accessible disclosure. The app remains a caregiver tool.

## Visual story

| Scene | Visual story | Website copy |
|---|---|---|
| Welcome | Warm moon and generous typography introduce a personal routine. Enter a birth year and the real catalog appears. | Make room for a gentler evening. |
| Tonight | An original lake horizon grounds a live-phase moon and a large start time. | Your evening begins at… / Start Moonrise now |
| Into the routine | The moon occupies its own clear stage; the warm sky changes with the engine. Controls are on separate dark panels. No scroll-driven story blocks the task. | A moment, together. / Read aloud |
| Music and memory | A familiar title and a prompt; opening a music link is the only event recorded as a song. | Spotify / YouTube / Next song |
| Reflection | Three equally prominent choices, without a success or failure judgment. | Every evening is worth remembering. |
| Constellation | One star per logged date in the last seven evenings. All outcomes count equally. Demo stars are explicitly labeled. No streak loss or patient score. | Every kind of evening counts. |
| Share with a clinician | The report keeps the compact print layout and medical caution. | Songs from your evenings |

## Editable source

- Design tokens and screen composition: `src/styles/visual.css`; supporting controls and print layout: `src/styles/app.css`.
- Screen copy: `src/screens/`. Star-window calculation: `src/components/Constellation.jsx`.
- Moon phase: engine `moonPhase()` -> SVG illumination mask in `MoonIcon.jsx`. Surface artwork is decorative, not a measured lunar image. The rising path is an illustration, not a prediction of local moon position.
- Native system fonts and Georgia: no font service, tracking or added runtime dependency.
- Slow halo and positional transitions respect reduced-motion preferences. Native fullscreen is opt-in; the routine already fills the browser viewport.
- Both art files are Vite imports and HTML preloads so they belong to the committed offline shell. SVG shapes and CSS gradients remain functional if artwork is unavailable.

## Original artwork provenance

Generated with Higgsfield `gpt_image_2_5`, September 25/26 2026. Ketan authorized using existing credits for app artwork; no purchase or subscription was made. The initial one-image estimate was 0.25 credits; submission responses do not independently prove the final credit debit.

1. Lake master job `0969c4c3-b6ff-44e7-8bcf-341a07d77e26`, 1344×752 PNG. Runtime WebP `src/assets/night-lake.webp`, 10,016 bytes.
   Prompt: Create original premium cinematic artwork for Moonrise, a calm caregiver web app. Wide 16:9 landscape. A quiet dark lake at blue hour, distant softly layered mountain silhouettes only in the bottom 25 percent, one thin muted copper horizon fading into deep midnight navy and ink blue. A few delicate distant stars. Upper 70 percent is beautifully graded dark negative space, nearly black navy, with subtle film texture for white HTML text and a separately rendered moon. Restrained, editorial, atmospheric, photorealistic matte painting; soothing rather than fantasy or sci-fi. No moon in the image, no sun, no people, no buildings, no lettering, no logos, no UI, no bright nebulae. Keep the horizon low and do not make a central focal point: an interactive moon will be composited in the UI.
2. Lunar surface job `efdcc477-046e-47b8-bbe9-72fee3511040`, 1024×1024 PNG, runtime WebP 640×640. Kept the authored SVG underneath as fallback.
   Prompt: A scientifically plausible photorealistic full Moon disc for a premium web app, straight-on lunar astrophotography, perfectly centered circular Moon filling exactly 96 percent of image width and height, full circular silhouette with no cropped edges. Neutral warm ivory-gray lunar regolith, realistic detailed maria and softly etched impact craters, natural broad dark lunar seas, detailed texture but low-contrast gentle luminance, no exaggerated ring outlines, no cartoon look. Pure solid black outside the disc. No stars, no glow outside the edge, no clouds, no text, no UI. Even full-moon illumination with subtle spherical shading and a crisp circular edge. This will be masked in SVG to the correct live lunar phase.

Original masters are retained in Ketan's workspace handoff, not required for building. No footage or third-party branding was copied. Generated scenery does not depict the user's real location.
