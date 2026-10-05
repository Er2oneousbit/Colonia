/**
 * texReport.js
 * ----------------------------------------------------------------------------
 * Checks of a painted texture's bytes, for the look lab's
 * __lab.textureReport() and the smoke test (the textures are painted on
 * the GPU, so these run in a browser on what it read back): the numbers
 * the eye cannot check every time.
 *
 *   lum       mean albedo as linear luminance (a real material lies about
 *             0.02 to 0.8: darker reads as a hole, lighter glows)
 *   rough     mean roughness (the ORM's green), 0..1
 *   alpha     [lowest, highest] alpha byte (a ground layer keeps its height
 *             there, normalised: 0 and 255)
 *   seamless  the step across the texture's wrap, both ways, is no bigger
 *             than the biggest step between other columns or rows (a seam
 *             would stand out over all of them; a joint may fall on it as
 *             anywhere)
 *   flat      mean of the normal map's blue (255 is flat)
 * ----------------------------------------------------------------------------
 */

const lin = (c) => Math.pow(c / 255, 2.2);

/** The checks of one texture's maps (RGBA bytes, n x n). */
export function mapStats({ albedo, orm, normal }, n) {
  let lum = 0;
  let rough = 0;
  let flat = 0;
  let lo = 255;
  let hi = 0;
  for (let i = 0; i < n * n; i++) {
    const j = i * 4;
    lum += 0.2126 * lin(albedo[j]) + 0.7152 * lin(albedo[j + 1]) + 0.0722 * lin(albedo[j + 2]);
    rough += orm[j + 1] / 255;
    flat += normal[j + 2];
    lo = Math.min(lo, albedo[j + 3]);
    hi = Math.max(hi, albedo[j + 3]);
  }
  return { lum: lum / (n * n), rough: rough / (n * n), alpha: [lo, hi], seamless: seamless(albedo, n), flat: flat / (n * n) };
}

/** No step across the wrap bigger than every step inside (see the header). */
export function seamless(bytes, n) {
  for (const across of [true, false]) {
    const steps = [];
    for (let c = 0; c < n; c++) {
      let sum = 0;
      for (let r = 0; r < n; r++) {
        const a = across ? r * n + c : c * n + r;
        const b = across ? r * n + ((c + 1) % n) : ((c + 1) % n) * n + r;
        for (let ch = 0; ch < 4; ch++) sum += Math.abs(bytes[a * 4 + ch] - bytes[b * 4 + ch]);
      }
      steps.push(sum);
    }
    if (steps[n - 1] > Math.max(...steps.slice(0, n - 1)) * 1.05) return false;
  }
  return true;
}
