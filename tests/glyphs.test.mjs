// Every build category names a drawn glyph that exists (a typo would show as a plain box in the sidebar).
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES } from '../src/data/buildings.js';
import { hasGlyph } from '../src/ui/glyphs.js';

test('glyphs: every build category has its drawn icon, and the top bar\'s names exist', () => {
  for (const c of CATEGORIES) assert.ok(hasGlyph(c.icon), `${c.key}: ${c.icon}`);
  for (const n of ['coin', 'crowd', 'pick', 'winter', 'spring', 'summer', 'autumn', 'face-1', 'face-2', 'face-3', 'face-4', 'pause', 'play1', 'play2', 'play3', 'play4', 'layers']) {
    assert.ok(hasGlyph(n), n);
  }
});
