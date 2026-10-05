/**
 * paint/cache.js
 * ----------------------------------------------------------------------------
 * Painted textures kept in IndexedDB, so a second visit draws them at once
 * instead of painting them again (about 40 MB for the look lab's well and
 * ground, under 3 MB for the game's ground).
 *
 * The key: what the job is (kind, name, size) and RECIPE_VERSION, a hash
 * the build takes of the painting code itself (the bundled paint worker:
 * paint/jobs.js, surfaces.js, texgen.js, ground/groundSurfaces.js and all
 * they use; scripts/build.mjs __TEX_RECIPES__). Any change to a recipe
 * changes the hash, so a stale texture is never read back, and nobody has
 * to remember to bump anything. Entries of other versions are deleted once
 * the page has loaded (pruneCache). Without the hash (the unbundled dev
 * server, node) there is no cache: the recipes there may be mid-edit.
 *
 * Storage may be missing, blocked (a private window, a sandboxed frame,
 * a page from file://), full or slow: every call is wrapped, opening and
 * reading give up after a few seconds, and any failure reads as a miss, so
 * the textures are then painted as if the cache were not there. An entry
 * is checked before use (its version and the length of every map) and
 * painted again if it does not fit.
 * ----------------------------------------------------------------------------
 */

import { mapsFit } from './jobs.js';

/* global __TEX_RECIPES__ */
/** The recipes' version (a hash of the paint worker's code), or null where there is no build. */
export const RECIPE_VERSION = typeof __TEX_RECIPES__ === 'string' ? __TEX_RECIPES__ : null;

const DB_NAME = 'colonia-textures';
const STORE = 'maps';
/** Give up opening the database after this long (a blocked or hung open must not hold the textures back). */
const OPEN_MS = 3000;
/** Give up a read after this long: the texture is painted instead. */
const READ_MS = 4000;

/** The key of a job's entry. */
export function textureKey(job, version = RECIPE_VERSION) {
  return `${job.kind}:${job.name}:${job.size}:${version}`;
}

/** Counters for the stats line and the tests. */
export const cacheStats = { hits: 0, misses: 0, writes: 0, failures: 0, enabled: !!RECIPE_VERSION };

let dbPromise = null;
/** The database once open (so a write can take its copy at once, not after an await). */
let dbOpen = null;
let off = !RECIPE_VERSION;

/** Run `fn` and swallow what it throws (storage that is there but refuses). */
function quietly(fn) {
  try {
    return fn();
  } catch {
    cacheStats.failures++;
    return undefined;
  }
}

/** The database, or null when there is none to be had. */
function openDb() {
  if (off) return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    let settled = false;
    const finish = (db) => {
      if (settled) {
        // (Opened after we gave up on it: close it again.)
        if (db) quietly(() => db.close());
        return;
      }
      settled = true;
      clearTimeout(timer);
      dbOpen = db;
      if (!db) {
        off = true;
        cacheStats.enabled = false;
      }
      resolve(db);
    };
    const timer = setTimeout(() => finish(null), OPEN_MS);
    const ok = quietly(() => {
      // (Reading indexedDB itself throws in some sandboxed frames.)
      const idb = globalThis.indexedDB;
      if (!idb) {
        finish(null);
        return true;
      }
      const req = idb.open(DB_NAME, 1);
      req.onupgradeneeded = () => quietly(() => req.result.createObjectStore(STORE));
      req.onsuccess = () => {
        const db = req.result;
        // Another tab wants a newer layout: let it have the database.
        db.onversionchange = () => {
          quietly(() => db.close());
          dbPromise = null;
          dbOpen = null;
        };
        finish(db);
      };
      req.onerror = () => finish(null);
      req.onblocked = () => finish(null);
      return true;
    });
    if (!ok) finish(null);
  });
  return dbPromise;
}

/**
 * Read the entries of `jobs` in one transaction: resolves to an array of
 * maps ({ albedo, normal, orm, height }) or null per job, in order.
 */
export async function cacheGetAll(jobs) {
  const none = jobs.map(() => null);
  const db = await openDb();
  if (!db) {
    cacheStats.misses += jobs.length;
    return none;
  }
  return new Promise((resolve) => {
    const out = none.slice();
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      for (const m of out) {
        if (m) cacheStats.hits++;
        else cacheStats.misses++;
      }
      resolve(out);
    };
    const timer = setTimeout(finish, READ_MS);
    const ok = quietly(() => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      jobs.forEach((job, i) => {
        const req = store.get(textureKey(job));
        req.onsuccess = () => {
          const v = req.result;
          if (v && v.v === RECIPE_VERSION && mapsFit(job, v)) out[i] = { albedo: v.albedo, normal: v.normal, orm: v.orm, height: v.height || null };
          else if (v) cacheDelete(job);
        };
      });
      tx.oncomplete = finish;
      tx.onerror = finish;
      tx.onabort = finish;
      return true;
    });
    if (!ok) finish();
  });
}

/**
 * Keep a job's painted maps. Never throws, never waits. The copy is taken
 * at once when the database is open, else when it opens: until then the
 * caller must not change the arrays (no one does: they become textures'
 * bytes as they are).
 */
export function cachePut(job, maps) {
  if (dbOpen) write(dbOpen, job, maps);
  else openDb().then((db) => { if (db) write(db, job, maps); });
}

function write(db, job, maps) {
  quietly(() => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ v: RECIPE_VERSION, albedo: maps.albedo, normal: maps.normal, orm: maps.orm, height: maps.height || null }, textureKey(job));
    tx.oncomplete = () => { cacheStats.writes++; };
    // (Full storage, or the user cleared it meanwhile: the texture is simply painted next time.)
    tx.onabort = () => { cacheStats.failures++; };
  });
}

function cacheDelete(job) {
  openDb().then((db) => {
    if (db) quietly(() => db.transaction(STORE, 'readwrite').objectStore(STORE).delete(textureKey(job)));
  });
}

/** A promise of start(resolve) that settles with fallback after ms instead (a transaction held up by another tab). */
function within(ms, fallback, start) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    start((v) => {
      clearTimeout(timer);
      resolve(v);
    });
  });
}

/** Delete the entries of other recipe versions (left by an older build). Resolves to how many went. */
export async function pruneCache() {
  const db = await openDb();
  if (!db) return 0;
  return within(READ_MS, 0, (resolve) => {
    let gone = 0;
    const ok = quietly(() => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const req = store.openKeyCursor();
      req.onsuccess = () => {
        const cur = req.result;
        if (!cur) return;
        if (!String(cur.key).endsWith(`:${RECIPE_VERSION}`)) {
          store.delete(cur.key);
          gone++;
        }
        cur.continue();
      };
      tx.oncomplete = () => resolve(gone);
      tx.onerror = () => resolve(gone);
      tx.onabort = () => resolve(gone);
      return true;
    });
    if (!ok) resolve(0);
  });
}

/** Forget every kept texture (the console's `textures clear`, the lab's Clear button). Resolves true when it was cleared. */
export async function clearCache() {
  const db = await openDb();
  if (!db) return false;
  return within(READ_MS, false, (resolve) => {
    const ok = quietly(() => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
      return true;
    });
    if (!ok) resolve(false);
  });
}
