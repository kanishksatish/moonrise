export const FLIGHT_MS = 2200

// One curve and clock drive the nozzle, its heading and the visible trail.
// De Casteljau's curve prefix ends at exactly the same point as the nozzle.
// Pixel-space control points keep heading and rocket proportions correct on
// narrow screens; callers only measure the SVG when its size changes.
export function flightFrame(elapsed, width, height) {
  const time = Math.min(1, Math.max(0, elapsed / FLIGHT_MS))
  const t = time ** 3 * (10 - 15 * time + 6 * time ** 2)
  const p0 = [width * .2, height * .86]
  const p1 = [width * .24, height * .8]
  const p2 = [width * .48, height * (340 / 600)]
  const p3 = [width * .74, height * .18]
  const mix = (a, b) => a.map((v, i) => v + (b[i] - v) * t)
  const a = mix(p0, p1), b = mix(p1, p2), c = mix(p2, p3)
  const d = mix(a, b), e = mix(b, c), point = mix(d, e)
  const heading = Math.atan2(e[1] - d[1], e[0] - d[0]) * 180 / Math.PI + 90
  const scale = Math.min(44, Math.max(30, width * .044)) / 52 * (1 - .76 * t * t)
  const fadeIn = Math.min(1, time / .08)
  const fadeOut = Math.min(1, (1 - time) / .18)
  return {
    point,
    // The local (26,75) nozzle is the origin before rotation and scaling.
    transform: `translate(${point.join(' ')}) rotate(${heading}) scale(${scale}) translate(-26 -75)`,
    trail: `M${p0.join(' ')} C${a.join(' ')} ${d.join(' ')} ${point.join(' ')}`,
    rocketOpacity: Math.max(0, fadeIn * fadeOut),
    trailOpacity: fadeIn * (1 - .82 * Math.max(0, (time - .85) / .15)),
  }
}
