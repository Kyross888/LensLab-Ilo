// GET /api/availability?camera=ID&from=YYYY-MM-DD&to=YYYY-MM-DD[&slots_for=YYYY-MM-DD]
//  → { free: { "2026-12-01": 0, ... } }  (0 = fully booked / blocked)  and slot space for one day
const { handler } = require('../lib/http');
const { db } = require('../lib/store');
const { isYmd, addDays, datesBetween, todayManila } = require('../lib/util');
const { SLOTS, SLOT_CAPACITY } = require('../lib/config');
const { ACTIVE, manilaHour } = require('../lib/booking');

module.exports = handler(async (ctx) => {
  const d = await db();
  const cam = await d.collection('cameras').findOne({ id: ctx.query.camera || '' });
  if (!cam) return ctx.respond({ success: false, error: 'Camera not found.' }, 404);

  const from = isYmd(ctx.query.from) ? ctx.query.from : todayManila();
  let to = isYmd(ctx.query.to) ? ctx.query.to : addDays(from, 90);
  if (to > addDays(from, 400)) to = addDays(from, 400);
  const units = cam.units || 1;

  const locks = await d.collection('locks').find({ camera_id: cam.id, date: { $gte: from, $lte: to } }, { projection: { date: 1, unit: 1 } }).toArray();
  const used = {};
  for (const l of locks) used[l.date] = (used[l.date] || 0) + 1;
  const free = {};
  for (const day of datesBetween(from, Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1)) {
    free[day] = Math.max(0, units - (used[day] || 0));
  }

  const out = { success: true, units, free };
  if (isYmd(ctx.query.slots_for)) {
    const day = ctx.query.slots_for;
    const rows = await d.collection('bookings').find({ start_date: day, status: { $in: ACTIVE } }, { projection: { slot_id: 1 } }).toArray();
    const count = {};
    for (const r of rows) count[r.slot_id] = (count[r.slot_id] || 0) + 1;
    const now = manilaHour();
    out.slots = SLOTS.map((s) => ({
      id: s.id, label: s.label,
      left: Math.max(0, SLOT_CAPACITY - (count[s.id] || 0)),
      past: day === todayManila() && s.start <= now,
    }));
  }
  ctx.respond(out);
});
