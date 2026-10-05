/**
 * paint/standIns.js
 * ----------------------------------------------------------------------------
 * What a texture shows until it is painted: its average colour and its
 * average occlusion/roughness/metalness (or plants), on a flat normal. The
 * scene draws from its first frame with these, and each texture's real
 * pixels go into the very same texture objects as they come (no shader
 * changes, no meshes appear: the stone gains its grain).
 *
 * The averages of every channel of the painted maps at full size, as RGBA
 * hex: 'albedo orm'. A test (tests/texpaint.test.mjs) paints each texture
 * and fails, printing the fresh line, when one drifts far from its recipe.
 * ----------------------------------------------------------------------------
 */

export const STAND_INS = Object.freeze({
  surface: {
    limestone: 'c6b592ff fcb600ff',
    travertine: 'bca47fff f9c800ff',
    basalt: '534c43ff f6ad00ff',
    tufa: 'a29579ff f3e000ff',
    cocciopesto: '8a5a48ff f4d000ff',
    plaster: 'b8977aff fedc00ff',
    wood: '625040ff edd700ff',
    bronze: '6e5136ff fe889fff',
    iron: '48423dff ff95b9ff',
    earth: '7f684aff f1ea00ff',
    rope: '947d58ff d4f200ff',
    wool: 'e1d8c7ff edf200ff',
    ripples: 'ffffffff ff0d00ff',
    terracotta: 'a25d3dff f5cc00ff',
  },
  ground: {
    grass: '5772299e eedbf9ff',
    meadow: '6a812d85 f5ccf2ff',
    scrub: '847e4f30 f3e478ff',
    forest: '5a542f59 d3d670ff',
    rock: '7f735d31 f6e017ff',
    sand: 'b9a2787e ffeb00ff',
    beach: 'c2b28c4c f9df00ff',
    soil: '6b51388c f8f002ff',
    bed: '8a836849 f3b300ff',
    gravel: 'a998794f dcd100ff',
    basalt: '534c44ad e99e00ff',
    flags: 'bfb091c7 f1b900ff',
    rubble: '75675976 e2e600ff',
    ripples: '8080807c ff0d00ff',
  },
});

/** A flat normal: straight out of the surface. */
const FLAT = [128, 128, 255, 255];
/** For a texture missing from the table: mid grey, half rough. */
const PLAIN = '808080ff ff8000ff';

const bytes4 = (hex) => [0, 2, 4, 6].map((k) => parseInt(hex.slice(k, k + 2), 16));

/** The stand-in of a job's maps: { albedo, normal, orm }, each [r, g, b, a] bytes. */
export function standIn(kind, name) {
  const [a, o] = ((STAND_INS[kind] && STAND_INS[kind][name]) || PLAIN).split(' ');
  return { albedo: bytes4(a), normal: FLAT.slice(), orm: bytes4(o) };
}

/** Fill `px` pixels of `out` (RGBA bytes, from pixel `at`) with one colour, a word at a time. */
export function fillPixels(out, rgba, px = out.length / 4, at = 0) {
  const one = new Uint8Array(rgba);
  const word = new Uint32Array(one.buffer)[0];
  // (The word in the platform's own byte order: written back the same way it reads as r, g, b, a.)
  if (out.byteOffset % 4 === 0) new Uint32Array(out.buffer, out.byteOffset + at * 4, px).fill(word);
  else for (let i = 0; i < px; i++) out.set(one, (at + i) * 4);
  return out;
}
