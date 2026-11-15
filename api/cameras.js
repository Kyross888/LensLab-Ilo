// GET /api/cameras → cameras, pickup slots and shop info for the website.
const { handler } = require('../lib/http');
const { db } = require('../lib/store');
const { SLOTS, SHOP, MAX_DAYS } = require('../lib/config');
const { todayManila } = require('../lib/util');

module.exports = handler(async (ctx) => {
  const d = await db();
  const cams = await d.collection('cameras').find({ active: true }).sort({ sort: 1, name: 1 }).toArray();
  ctx.respond({
    success: true,
    today: todayManila(),
    max_days: MAX_DAYS,
    shop: SHOP,
    slots: SLOTS.map(({ id, label }) => ({ id, label })),
    cameras: cams.map((c) => ({ id: c.id, name: c.name, tagline: c.tagline, price_per_day: c.price_per_day, deposit: c.deposit, units: c.units, includes: c.includes || [], image: c.image })),
  });
});
