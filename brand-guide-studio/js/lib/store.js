/* ============================================================
   PK.store — persistent per-client brand kits
   localStorage registry keyed by client slug + JSON import/export
   Replaces the old "remembered in that browser" artifact memory
   ============================================================ */
window.PK = window.PK || {};
PK.store = (function () {
  'use strict';
  const KEY = 'pk.brandkit.v2';
  const U = PK.util;

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      const data = raw ? JSON.parse(raw) : {};
      if (!data.clients) data.clients = [];
      return data;
    } catch (e) { return { clients: [] }; }
  }
  function write(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function list() {
    return read().clients
      .slice()
      .sort((a, b) => (b.updated || 0) - (a.updated || 0))
      .map((c) => ({ id: c.id, name: c.kit && c.kit.name || c.id, updated: c.updated }));
  }

  function get(id) {
    const c = read().clients.find((x) => x.id === id);
    return c ? c.kit : null;
  }

  function save(kit) {
    if (!kit.id) kit.id = U.slug(kit.name);
    kit.updated = new Date().toISOString();
    const data = read();
    const i = data.clients.findIndex((x) => x.id === kit.id);
    if (i >= 0) data.clients[i].kit = kit; else data.clients.push({ id: kit.id, kit });
    write(data);
    return kit;
  }

  function remove(id) {
    const data = read();
    data.clients = data.clients.filter((x) => x.id !== id);
    write(data);
  }

  function newId(name) {
    const base = U.slug(name);
    const taken = read().clients.map((c) => c.id);
    let id = base, n = 2;
    while (taken.includes(id)) id = base + '-' + n++;
    return id;
  }

  function exportJSON(kit) {
    const clean = JSON.parse(JSON.stringify(kit));
    return JSON.stringify({ format: 'pk-brandkit', version: 2, kit: clean }, null, 2);
  }

  function importJSON(text) {
    const parsed = JSON.parse(text);
    const kit = parsed.kit || parsed;
    if (!kit.name) throw new Error('Not a brand kit: missing "name".');
    const id = newId(kit.name);
    const final = Object.assign({}, kit, { id });
    return save(final);
  }

  return { list, get, save, remove, newId, exportJSON, importJSON };
})();
