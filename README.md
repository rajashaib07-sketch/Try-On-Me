# Fashion Vault Store — AI Try-On

A "See it on you" page: customer uploads a photo, picks one of 9 summer
tracksuits, and the backend calls Google's Gemini image model to generate a
photo of them wearing it.

```
tryon-app/
├─ server.js        Express backend + /api/tryon (calls Gemini)
├─ products.js       The 9 tracksuits (name, price, image, link)
├─ public/
│  ├─ index.html
│  ├─ style.css
│  └─ script.js
├─ .env.example
└─ package.json
```

## 1. Install dependencies

```bash
cd tryon-app
npm install
```

## 2. Add your Gemini API key

1. Get a free key at https://aistudio.google.com/app/apikey
2. Copy the example env file and paste your key in:

```bash
cp .env.example .env
```

```
GEMINI_API_KEY=AIza...your_key...
```

## 3. Run it

```bash
npm start
```

Open **http://localhost:3000**

## How it works

1. `public/script.js` loads the 9 products from `GET /api/products` and lets
   the customer pick one, then upload/drag a photo.
2. On "Stitch on me", the browser sends `{ productId, photo }` (photo as a
   base64 data URL) to `POST /api/tryon`.
3. `server.js`:
   - downloads the chosen product's image,
   - sends **both images + a prompt** to Gemini's image model
     (`gemini-2.5-flash-image`) asking it to put the customer in that garment,
   - Gemini returns a generated image, which the server sends back as a
     base64 data URL.
4. The frontend swaps the uploaded photo preview for the generated result.

Nothing is written to disk — photos only live in memory for the duration of
that one request.

## Notes / things to adjust for production

- **Rate limiting**: add something like `express-rate-limit` on `/api/tryon`
  — image generation calls cost money per request, and the page currently
  has no cap on how many times one visitor can click "Stitch on me" (the
  khizaromer.pk reference you shared limits this to "2 free try-ons per
  device per day" — worth copying that idea).
- **Products**: edit `products.js` to add/remove/re-order items, or swap it
  for a call to your real store's product API if you don't want to
  hand-maintain this list.
- **Image size**: Gemini has an input size limit; very large phone photos
  may need client-side downscaling before upload (e.g. draw to a `<canvas>`
  and re-export at ~1600px on the long edge) if you see errors on real
  devices.
- **Model name**: `gemini-2.5-flash-image` is the current Gemini image
  generation/editing model at the time of writing. If Google renames or
  updates it, change `GEMINI_MODEL` in `server.js` — check
  https://ai.google.dev/gemini-api/docs/models for the current name.
- **Hosting**: deploy `server.js` anywhere that runs Node 18+ (Render,
  Railway, a VPS, etc.) and keep `GEMINI_API_KEY` as a server-side
  environment variable — never ship it in frontend code.
