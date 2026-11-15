// Booking rules: validation, race-safe date locking, cancelling.
const { SLOTS, MAX_DAYS, SLOT_CAPACITY } = require('./config');
const { isYmd, todayManila, datesBetween, addDays, makeRef, str, normPhone } = require('./util');

const ACTIVE = ['pending', 'confirmed'];
const last10 = (p) => normPhone(p).replace(/\D/g, '').slice(-10);

function manilaHour() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}

/** Try to lock every date for one unit; returns true on success (all-or-nothing). */
async function lockDates(db, camera, unit, dates, ref, kind = 'booking') {
  const docs = dates.map((date) => ({ camera_id: camera.id, unit, date, ref, kind, created_at: new Date() }));
  try {
    await db.collection('locks').insertMany(docs, { ordered: true });
    return true;
  } catch (e) {
    await db.collection('locks').deleteMany({ ref }); // roll back the ones that did get in
    if (e && (e.code === 11000 || (e.writeErrors && e.writeErrors.length) || /duplicate/i.test(e.message || ''))) return false;
    throw e;
  }
}

async function createBooking(db, input, { admin = false } = {}) {
  const camera = await db.collection('cameras').findOne({ id: str(input.camera_id, 60) });
  if (!camera || (!camera.active && !admin)) return { error: 'That camera is not available.', status: 404 };

  const start = str(input.start_date, 10);
  const days = parseInt(input.days, 10);
  if (!isYmd(start)) return { error: 'Please choose a start date.', status: 400 };
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) return { error: `Rental length must be 1 to ${MAX_DAYS} days.`, status: 400 };
  const today = todayManila();
  if (!admin && start < today) return { error: 'That date has already passed.', status: 400 };

  const slot = SLOTS.find((s) => s.id === input.slot_id);
  if (!slot) return { error: 'Please choose a pickup time.', status: 400 };
  if (!admin && start === today && slot.start <= manilaHour()) return { error: 'That pickup time has already passed today. Pick a later slot.', status: 400 };

  const name = str(input.name, 80);
  const phone = normPhone(input.phone);
  const email = str(input.email, 120);
  if (name.length < 2) return { error: 'Please enter your full name.', status: 400 };
  if (last10(phone).length < 10) return { error: 'Please enter a valid mobile number.', status: 400 };
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'That email address looks wrong.', status: 400 };

  if (!admin) {
    const open = await db.collection('bookings').countDocuments({ phone_key: last10(phone), status: { $in: ACTIVE }, end_date: { $gte: today } });
    if (open >= 3) return { error: 'You already have 3 active bookings. Please contact us on Facebook to book more.', status: 429 };
    const used = await db.collection('bookings').countDocuments({ start_date: start, slot_id: slot.id, status: { $in: ACTIVE } });
    if (used >= SLOT_CAPACITY) return { error: 'That pickup time is fully booked. Please choose another slot.', status: 409 };
  }

  const dates = datesBetween(start, days);
  let ref = makeRef();
  for (let i = 0; i < 4 && (await db.collection('bookings').findOne({ ref }, { projection: { _id: 1 } })); i++) ref = makeRef();

  let unit = 0;
  for (let u = 1; u <= (camera.units || 1); u++) {
    if (await lockDates(db, camera, u, dates, ref)) { unit = u; break; }
  }
  if (!unit) return { error: 'Sorry, those dates were just taken. Please pick other dates.', status: 409 };

  const booking = {
    ref, camera_id: camera.id, camera_name: camera.name, unit,
    start_date: start, end_date: dates[dates.length - 1], days, dates,
    slot_id: slot.id, pickup_label: slot.label,
    name, phone, phone_key: last10(phone), email, facebook: str(input.facebook, 120), notes: str(input.notes, 400),
    price_per_day: camera.price_per_day, rental_total: camera.price_per_day * days, deposit: camera.deposit || 0,
    total: camera.price_per_day * days,
    status: admin && input.status === 'confirmed' ? 'confirmed' : 'pending',
    source: admin ? 'admin' : 'website',
    created_at: new Date(), updated_at: new Date(),
  };
  try {
    await db.collection('bookings').insertOne(booking);
  } catch (e) {
    await db.collection('locks').deleteMany({ ref });
    throw e;
  }
  return { booking };
}

async function cancelBooking(db, ref) {
  await db.collection('bookings').updateOne({ ref }, { $set: { status: 'cancelled', updated_at: new Date() } });
  await db.collection('locks').deleteMany({ ref, kind: 'booking' });
}

// What the customer is allowed to see
const publicView = (b) => ({
  ref: b.ref, status: b.status, camera_name: b.camera_name, camera_id: b.camera_id,
  start_date: b.start_date, end_date: b.end_date, days: b.days, pickup_label: b.pickup_label,
  name: b.name, total: b.total, deposit: b.deposit, created_at: b.created_at,
});

module.exports = { createBooking, cancelBooking, publicView, lockDates, last10, ACTIVE, manilaHour };
