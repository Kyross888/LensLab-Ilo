// POST /api/bookings              → create a booking request
// GET  /api/bookings?ref=&phone=  → look up a booking
// POST /api/bookings?action=cancel {ref, phone} → customer cancels (at least 1 day before start)
const { handler } = require('../lib/http');
const { db } = require('../lib/store');
const { createBooking, cancelBooking, publicView, last10 } = require('../lib/booking');
const { str, todayManila } = require('../lib/util');

module.exports = handler(async (ctx) => {
  const d = await db();

  if (ctx.method === 'POST' && ctx.query.action === 'cancel') {
    const b = await find(d, ctx.body.ref, ctx.body.phone);
    if (!b) return ctx.respond({ success: false, error: 'Booking not found. Check the reference and phone number.' }, 404);
    if (!['pending', 'confirmed'].includes(b.status)) return ctx.respond({ success: false, error: 'This booking can no longer be cancelled.' }, 400);
    if (b.start_date <= todayManila()) return ctx.respond({ success: false, error: 'Bookings starting today can only be cancelled by contacting us.' }, 400);
    await cancelBooking(d, b.ref);
    return ctx.respond({ success: true, message: 'Your booking was cancelled.' });
  }

  if (ctx.method === 'POST') {
    if (str(ctx.body.website)) return ctx.respond({ success: true, booking: { ref: 'LL-OK' } }); // honeypot: silently drop bots
    const r = await createBooking(d, ctx.body);
    if (r.error) return ctx.respond({ success: false, error: r.error }, r.status || 400);
    return ctx.respond({ success: true, booking: publicView(r.booking) }, 201);
  }

  const b = await find(d, ctx.query.ref, ctx.query.phone);
  if (!b) return ctx.respond({ success: false, error: 'Booking not found. Check the reference and phone number.' }, 404);
  ctx.respond({ success: true, booking: publicView(b) });
});

async function find(d, ref, phone) {
  const r = str(ref, 20).toUpperCase();
  if (!r || last10(phone || '').length < 10) return null;
  const b = await d.collection('bookings').findOne({ ref: r });
  return b && b.phone_key === last10(phone) ? b : null;
}
