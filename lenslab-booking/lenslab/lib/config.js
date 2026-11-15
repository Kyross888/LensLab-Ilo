// Shop settings used by the API and (via /api/cameras) the website.
module.exports = {
  SHOP: {
    name: 'LensLab ILO',
    address: 'Sto. Niño Sur, Arevalo, Iloilo City',
    facebook: 'LensLab ILO',
    facebook_url: 'https://www.facebook.com/search/top?q=LensLab%20ILO',
  },
  MAX_DAYS: 14,         // longest rental a customer can book online
  SLOT_CAPACITY: 3,     // how many pickups per time slot per day
  // Pickup / return time slots (hour = 24h start, used to hide slots already past today)
  SLOTS: [
    { id: 's1', label: '9:00 – 10:30 AM', start: 9 },
    { id: 's2', label: '10:30 AM – 12:00 PM', start: 10.5 },
    { id: 's3', label: '1:00 – 2:30 PM', start: 13 },
    { id: 's4', label: '2:30 – 4:00 PM', start: 14.5 },
    { id: 's5', label: '4:00 – 5:30 PM', start: 16 },
    { id: 's6', label: '5:30 – 7:00 PM', start: 17.5 },
  ],
  // First-run sample cameras (prices are placeholders — edit them in the admin page)
  CAMERAS: [
    { id: 'canon-100d', name: 'Canon EOS 100D', tagline: 'Ultra-compact DSLR, perfect for beginners', price_per_day: 500, deposit: 1000, units: 1, image: 'img/canon-100d.jpg', sort: 1,
      includes: ['EF-S 18–55mm kit lens', 'Battery & charger', 'Memory card', 'Camera strap'] },
    { id: 'canon-m100', name: 'Canon EOS M100', tagline: 'Light mirrorless camera for vlogs & travel', price_per_day: 600, deposit: 1000, units: 1, image: 'img/canon-m100.jpg', sort: 2,
      includes: ['EF-M 15–45mm kit lens', 'Battery & charger', 'Memory card', 'Camera strap'] },
    { id: 'canon-750d', name: 'Canon EOS 750D', tagline: 'Sharp 24MP DSLR with fast autofocus', price_per_day: 700, deposit: 1500, units: 1, image: 'img/canon-750d.jpg', sort: 3,
      includes: ['EF-S 18–55mm kit lens', 'Battery & charger', 'Memory card', 'Camera strap'] },
    { id: 'canon-1200d', name: 'Canon EOS 1200D', tagline: 'Reliable all-rounder for events & portraits', price_per_day: 500, deposit: 1000, units: 1, image: 'img/canon-1200d.jpg', sort: 4,
      includes: ['EF-S 18–55mm kit lens', 'Battery & charger', 'Memory card', 'Camera strap'] },
  ],
};
