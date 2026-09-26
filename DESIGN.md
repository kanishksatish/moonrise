# Moonrise visual direction · v2

A quiet observatory for an evening together. Charcoal ink, warm ivory, apricot light and muted sage replace the earlier blue card layout. Large editorial typography carries the important decisions; small orbital details and original artwork create atmosphere. Caregiver tasks remain clear and close at hand.

## Design system

| Role | Actual token or source |
|---|---|
| Background / surface | `--bg: #101316` / `--surface: #1b2024` |
| Primary text / secondary text | `--text: #f5f0e7` / `--muted: #b9c2c3` |
| Action / action text | `--accent: #eac39c` / `--accent-text: #24201b` |
| Outcome accents | Sage `#abc2af`, sand `#d0bf9f`, lavender `#c2b2cb`; words and distinct marks accompany color. |
| Type | Georgia display headings; native system sans-serif controls and body. No external font service. |
| Controls | Body text designed at 20px minimum; main controls at least 48px high. Visible focus rings; explicit button labels. Final validation is recorded separately. |
| Layout | Desktop side navigation and a broad scene/journal composition; bottom navigation and a stacked routine on smaller screens. |

## Visual story and actual behavior

| Scene | Composition and behavior | Current copy / action |
|---|---|---|
| Welcome | Orbit artwork and a personal introduction sit beside three numbered setup sections. The entered birth year filters the real song catalog. | Make room for a gentler evening. / Their story. / Under your sky. |
| Today | Live calculated timing and lunar phase sit in a cinematic lake scene. A separate journal rail holds the seven-evening constellation and music context. Weather details remain expandable. | A softer landing. For both of you. / Your suggested start / Start Moonrise now |
| Launch | An original SVG rocket takes a 2.4-second flight only after the caregiver explicitly starts a routine. It is silent, can be skipped by button or Escape, and is bypassed when reduced motion is requested. It never starts on page load. | A little space for calm. / Skip launch |
| Routine | One continuous landscape surrounds a slow illustrated moon, a readable conversation card and music links. Native fullscreen remains optional. | A moment, together. / Next prompt / Quiet view / Finish |
| Quiet view | Hides the conversation and song cards; the moon scene and session controls remain. Restore with Show conversation. It does not start or stop external audio. | Quiet view / Show conversation |
| Reflection | Three equally prominent choices use distinct line illustrations and plain language. Choosing Episode can be followed by an optional onset time. | How was tonight? / Calm / Restless / Episode |
| Constellation | One star per logged date in the last seven evenings, using the 04:00 evening boundary. All outcomes count equally. Demo evenings are labeled. No score, streak penalty or promised benefit. | One star for each evening you record. Every kind of evening counts. |
| Report | An editorial weekly journal shows actual recorded days, equally sized outcome marks, timing, weather and neutral song information. Missing data remains visible. Screen-only composition leaves the existing compact print report available. | A week of evenings. / The shape of your week / Songs from your evenings / Print report |

## Editable source and handoff

- Shared tokens, navigation, Today and routine: `src/styles/visual.css`; base controls and print: `src/styles/app.css`.
- Setup and Log: `src/styles/onboarding.css`. Report: `src/styles/report-visual.css` and `src/screens/Report.jsx`.
- Rocket: `src/components/LaunchSequence.jsx` and `src/styles/launch-sequence.css`. No generated video, autoplay audio or added animation library is used.
- Reusable native artwork: `MoonIcon.jsx`, `Brand.jsx`, `Constellation.jsx`, the CSS `.record-art` and inline SVG outcome marks. Their shapes are editable in source.
- Lunar phase comes from engine `moonPhase()` and an SVG illumination mask. The lunar surface is decorative artwork, not a measured image; the rising path is an illustration, not local moon-position prediction.
- Lake and lunar WebPs remain local imported assets, with HTML preloads for the offline shell. SVG moon shapes remain underneath the texture.
- The handoff style tile embeds a snapshot of the actual CSS and server-rendered native components, with local copies of both WebPs. Its sample names, time and logs are explicitly illustrative. The running app remains the source of truth.

## Product meaning and boundaries

The schedule uses a documented prototype rule and stored episode times; it is not a clinical prediction. Song links open Spotify or YouTube externally; opening a link is the event recorded, not confirmed listening. Next song does not record a play. Next prompt advances the conversation manually. Optional Claude-written prompts enter a routine only after caregiver approval; approval and keyword filters do not establish clinical safety.

The report describes observations, not cause and effect. The interface makes no claim to treat, prevent or reduce sundowning or agitation. A future hospice pilot needs clinical, ethics, privacy, security and usability review; the separate pilot-readiness memo describes the proposed gates. Browser verification, print pagination and test results are recorded in the project handoff after validation.

## Original artwork provenance

Generated with Higgsfield `gpt_image_2_5`, September 25/26 2026. Ketan authorized using existing credits for app artwork; no purchase or subscription was made. The initial one-image estimate was 0.25 credits; submission responses do not independently prove the final credit debit.

1. Lake master job `0969c4c3-b6ff-44e7-8bcf-341a07d77e26`, 1344×752 PNG. Runtime WebP `src/assets/night-lake.webp`, 10,016 bytes.
   Prompt: Create original premium cinematic artwork for Moonrise, a calm caregiver web app. Wide 16:9 landscape. A quiet dark lake at blue hour, distant softly layered mountain silhouettes only in the bottom 25 percent, one thin muted copper horizon fading into deep midnight navy and ink blue. A few delicate distant stars. Upper 70 percent is beautifully graded dark negative space, nearly black navy, with subtle film texture for white HTML text and a separately rendered moon. Restrained, editorial, atmospheric, photorealistic matte painting; soothing rather than fantasy or sci-fi. No moon in the image, no sun, no people, no buildings, no lettering, no logos, no UI, no bright nebulae. Keep the horizon low and do not make a central focal point: an interactive moon will be composited in the UI.
2. Lunar surface job `efdcc477-046e-47b8-bbe9-72fee3511040`, 1024×1024 PNG, runtime WebP 640×640. Kept the authored SVG underneath as fallback.
   Prompt: A scientifically plausible photorealistic full Moon disc for a premium web app, straight-on lunar astrophotography, perfectly centered circular Moon filling exactly 96 percent of image width and height, full circular silhouette with no cropped edges. Neutral warm ivory-gray lunar regolith, realistic detailed maria and softly etched impact craters, natural broad dark lunar seas, detailed texture but low-contrast gentle luminance, no exaggerated ring outlines, no cartoon look. Pure solid black outside the disc. No stars, no glow outside the edge, no clouds, no text, no UI. Even full-moon illumination with subtle spherical shading and a crisp circular edge. This will be masked in SVG to the correct live lunar phase.

Original masters are retained in Ketan's workspace handoff, not required for building. No footage or third-party branding was copied. Generated scenery does not depict the user's real location.
