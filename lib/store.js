// Opens the database, makes sure indexes + starter cameras exist (once per cold start).
const { getDb } = require('./db');
const { CAMERAS } = require('./config');

let ready;
async function db() {
  const d = await getDb();
  if (!ready) {
    ready = (async () => {
      const safe = async (p) => { try { await p; } catch (e) { console.warn('index:', e.message); } };
      await safe(d.collection('locks').createIndex({ camera_id: 1, unit: 1, date: 1 }, { unique: true }));
      await safe(d.collection('locks').createIndex({ ref: 1 }));
      await safe(d.collection('bookings').createIndex({ ref: 1 }, { unique: true }));
      await safe(d.collection('bookings').createIndex({ phone: 1 }));
      await safe(d.collection('bookings').createIndex({ created_at: -1 }));
      for (const c of CAMERAS) {
        await d.collection('cameras').updateOne({ id: c.id }, { $setOnInsert: { ...c, active: true } }, { upsert: true });
      }
    })().catch((e) => { ready = null; throw e; });
  }
  await ready;
  return d;
}
module.exports = { db };
