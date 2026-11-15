# LensLab ILO – Camera Booking Website

Customers pick a camera, dates and a pickup slot at `/`. You manage everything at `/admin`.

## Deploy (separate from Luna's POS)
1. Create a NEW GitHub repo (e.g. `lenslab-booking`) and upload everything in this folder (not `node_modules`).
2. On vercel.com → Add New → Project → import that repo. Framework: Other. Do not change build settings.
3. Project → Settings → Environment Variables, add:
   - `MONGODB_URI` – your Atlas connection string (a separate DB user for LensLab is best)
   - `MONGODB_DB` – `lenslab_db`  (keeps data separate from Luna's POS)
   - `ADMIN_PASSWORD` – the password for `/admin`
   - `JWT_SECRET` – any long random text
4. Deployments → Redeploy. Open `/admin`, log in, then go to **Cameras & prices** and set your real prices.

Atlas → Network Access must allow `0.0.0.0/0` (Vercel has no fixed IP).

## Edit things
- Prices, deposits, units, descriptions: `/admin` → Cameras & prices.
- Pickup time slots, max rental days, bookings per slot: `lib/config.js`.
- Camera photos: replace files in `public/img/` (same names).

## How double-booking is prevented
Each booked day is stored as one record with a unique index (camera + unit + date). If two people submit at the same moment, the database lets only one through. Cancelling frees the days.

## Run locally
`npm install`, copy `.env.example` to `.env.local`, then `npm run dev` → http://localhost:3000
