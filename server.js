require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const products = require("./products");

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash-image"; // Gemini's image generation/editing model
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

app.use(cors());
app.use(express.json({ limit: "25mb" })); // photos come in as base64, so allow a generous body size
app.use(express.static(path.join(__dirname, "public")));

// ---- helpers -------------------------------------------------------------

/** Fetch a remote image and return { mimeType, base64 }. */
async function fetchImageAsBase64(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Could not download product image (${res.status})`);
  }
  const mimeType = res.headers.get("content-type") || "image/jpeg";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { mimeType, base64: buffer.toString("base64") };
}

/** Split a data URL like "data:image/png;base64,AAAA" into its parts. */
function parseDataUrl(dataUrl) {
  const match = /^data:(.+);base64,(.*)$/.exec(dataUrl || "");
  if (!match) throw new Error("Uploaded photo is not a valid image file.");
  return { mimeType: match[1], base64: match[2] };
}

// ---- routes ---------------------------------------------------------------

// List the try-on catalog (used by the frontend to build the product grid)
app.get("/api/products", (req, res) => {
  res.json(products);
});

// Run the virtual try-on: user photo + chosen product -> Gemini -> new image
app.post("/api/tryon", async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({
        error: "Server is missing GEMINI_API_KEY. Add it to your .env file and restart the server."
      });
    }

    const { productId, photo } = req.body;
    const product = products.find((p) => p.id === productId);
    if (!product) {
      return res.status(400).json({ error: "Unknown product selected." });
    }
    if (!photo) {
      return res.status(400).json({ error: "No photo was uploaded." });
    }

    const userPhoto = parseDataUrl(photo);
    const garmentPhoto = await fetchImageAsBase64(product.image);

    const prompt =
      `You are a virtual try-on assistant for a clothing store. The first image is a photo of a customer. ` +
      `The second image shows a tracksuit/garment named "${product.name}". ` +
      `Generate a new, photorealistic image of the SAME customer (keep their face, body shape, pose, and background as close to the original photo as possible) ` +
      `wearing this exact garment, matching its color, pattern, and design accurately. ` +
      `The fit should look natural and true to size. Output only the final edited photo, no extra text.`;

    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inline_data: { mime_type: userPhoto.mimeType, data: userPhoto.base64 } },
            { inline_data: { mime_type: garmentPhoto.mimeType, data: garmentPhoto.base64 } }
          ]
        }
      ],
      generationConfig: {
        responseModalities: ["IMAGE"]
      }
    };

    const geminiRes = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY
      },
      body: JSON.stringify(requestBody)
    });

    const geminiData = await geminiRes.json();

    if (!geminiRes.ok) {
      console.error("Gemini API error:", geminiData);
      return res.status(502).json({
        error: geminiData?.error?.message || "Gemini API request failed."
      });
    }

    const parts = geminiData?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p) => p.inlineData || p.inline_data);
    const inline = imagePart?.inlineData || imagePart?.inline_data;

    if (!inline?.data) {
      const textPart = parts.find((p) => p.text)?.text;
      return res.status(502).json({
        error: textPart || "Gemini did not return an image. Try a clearer, full-body photo."
      });
    }

    const outMime = inline.mimeType || inline.mime_type || "image/png";
    res.json({ image: `data:${outMime};base64,${inline.data}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Something went wrong." });
  }
});

app.listen(PORT, () => {
  console.log(`Try-on server running at http://localhost:${PORT}`);
  if (!GEMINI_API_KEY) {
    console.warn("⚠️  GEMINI_API_KEY is not set — copy .env.example to .env and add your key.");
  }
});
