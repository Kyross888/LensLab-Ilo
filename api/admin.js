// Admin API (password protected). Everything uses ?action=...
const crypto = require('crypto');
const { handler } = require('../lib/http');
const { db } = require('../lib/store');
const { createBooking, cancelBooking, lockDates } = require('../lib/booking');
const { str, isYmd, datesBetween, addDays, todayManila } = require('../lib/util');
const { SLOTS } = require('../lib/config');

const same = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

module.exports = handler(async (ctx) => {
  const action = ctx.query.action || '';

  if (action === 'login') {
    const pw = process.env.ADMIN_PASSWORD;
    if (!pw) return ctx.respond({ success: false, error: 'ADMIN_PASSWORD is not set on the server.' }, 500);
    await new Promise((r) => setTimeout(r, 400)); // slows down password guessing
    if (!same(ctx.body.password || '', pw)) return ctx.respond({ success: false, error: 'Wrong password.' }, 401);
    ctx.setAdmin(true);
    return ctx.respond({ success: true });
  }
  if (action === 'logout') { ctx.setAdmin(false); return ctx.respond({ success: true }); }
  if (!ctx.isAdmin()) return ctx.respond({ success: false, error: 'Please log in.', login: true }, 401);
  if (action === 'me') return ctx.respond({ success: true });

  const d = await db();

  if (action === 'bookings') {
    const q = {};
    if (ctx.query.status && ctx.query.status !== 'all') q.status = ctx.query.status;
    if (isYmd(ctx.query.date)) q.dates = ctx.query.date;
    const s = str(ctx.query.q, 60);
    if (s) {
      const rx = new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      q.$or = [{ ref: rx }, { name: rx }, { phone: rx }, { camera_name: rx }];
    }
    const rows = await d.collection('bookings').find(q).sort({ created_at: -1 }).limit(300).toArray();
    const all = await d.collection('bookings').find({}, { projection: { status: 1, total: 1 } }).toArray();
    const counts = { pending: 0, confirmed: 0, completed: 0, cancelled: 0 };
    let revenue = 0;
    for (const b of all) { counts[b.status] = (counts[b.status] || 0) + 1; if (['confirmed', 'completed'].includes(b.status)) revenue += b.total || 0; }
    return ctx.respond({ success: true, bookings: rows.map(({ _id, dates, phone_key, ...b }) => b), counts, revenue });
  }

  if (action === 'set_status' && ctx.method === 'POST') {
    const b = await d.collection('bookings').findOne({ ref: str(ctx.body.ref, 20) });
    const status = ctx.body.status;
    if (!b) return ctx.respond({ success: false, error: 'Booking not found.' }, 404);
    if (!['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) return ctx.respond({ success: false, error: 'Bad status.' }, 400);
    if (b.status === 'cancelled' && status !== 'cancelled') return ctx.respond({ success: false, error: 'A cancelled booking cannot be reopened. Create a new booking instead.' }, 400);
    if (status === 'cancelled') await cancelBooking(d, b.ref);
    else await d.collection('bookings').updateOne({ ref: b.ref }, { $set: { status, updated_at: new Date() } });
    return ctx.respond({ success: true });
  }

  if (action === 'add_booking' && ctx.method === 'POST') {
    const r = await createBooking(d, { ...ctx.body, status: 'confirmed' }, { admin: true });
    if (r.error) return ctx.respond({ success: false, error: r.error }, r.status || 400);
    return ctx.respond({ success: true, ref: r.booking.ref });
  }

  if (action === 'cameras') {
    const cams = await d.collection('cameras').find({}).sort({ sort: 1 }).toArray();
    return ctx.respond({ success: true, cameras: cams.map(({ _id, ...c }) => c), slots: SLOTS });
  }

  if (action === 'save_camera' && ctx.method === 'POST') {
    const b = ctx.body, id = str(b.id, 60);
    const set = {
      name: str(b.name, 80), tagline: str(b.tagline, 140),
      price_per_day: Math.max(0, Math.round(Number(b.price_per_day) || 0)),
      deposit: Math.max(0, Math.round(Number(b.deposit) || 0)),
      units: Math.min(20, Math.max(1, parseInt(b.units, 10) || 1)),
      active: !!b.active,
      includes: Array.isArray(b.includes) ? b.includes.map((x) => str(x, 80)).filter(Boolean).slice(0, 10) : [],
    };
    if (!set.name) return ctx.respond({ success: false, error: 'Name is required.' }, 400);
    const r = await d.collection('cameras').updateOne({ id }, { $set: set });
    if (!r.matchedCount) return ctx.respond({ success: false, error: 'Camera not found.' }, 404);
    return ctx.respond({ success: true });
  }

  if (action === 'blocks') {
    const rows = await d.collection('locks').find({ kind: 'block', date: { $gte: todayManila() } }).sort({ date: 1 }).limit(500).toArray();
    return ctx.respond({ success: true, blocks: rows.map((r) => ({ camera_id: r.camera_id, date: r.date, unit: r.unit, reason: r.reason || '' })) });
  }

  if (action === 'block' && ctx.method === 'POST') {
    const cam = await d.collection('cameras').findOne({ id: str(ctx.body.camera_id, 60) });
    const from = str(ctx.body.from, 10), to = str(ctx.body.to, 10) || from;
    if (!cam || !isYmd(from) || !isYmd(to) || to < from) return ctx.respond({ success: false, error: 'Choose a camera and valid dates.' }, 400);
    const days = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
    if (days > 120) return ctx.respond({ success: false, error: 'Block at most 120 days at a time.' }, 400);
    let skipped = 0;
    for (const date of datesBetween(from, days)) {
      for (let u = 1; u <= (cam.units || 1); u++) {
        const ok = await lockDates(d, cam, u, [date], 'BLOCK-' + cam.id + '-' + date + '-' + u, 'block');
        if (ok) await d.collection('locks').updateOne({ ref: 'BLOCK-' + cam.id + '-' + date + '-' + u }, { $set: { reason: str(ctx.body.reason, 80) } });
        else skipped++;
      }
    }
    return ctx.respond({ success: true, message: skipped ? 'Blocked. Some days were already booked and were left as they are.' : 'Dates blocked.' });
  }

  if (action === 'unblock' && ctx.method === 'POST') {
    await d.collection('locks').deleteMany({ camera_id: str(ctx.body.camera_id, 60), date: str(ctx.body.date, 10), kind: 'block' });
    return ctx.respond({ success: true });
  }

  ctx.respond({ success: false, error: 'Unknown action.' }, 400);
});
