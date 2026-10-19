import { PRODUCTS } from "./products.js";

function setCors(req, res) {
  const allowedOrigin = "https://raymond-apk-store.web.app";
  const origin = req.headers.origin;
  if (origin === allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function handleMethod(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return false;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return false;
  }
  if (req.headers.origin && req.headers.origin !== "https://raymond-apk-store.web.app") {
    res.status(403).json({ error: "Origin not allowed" });
    return false;
  }
  return true;
}

export default async function handler(req, res) {
  if (!handleMethod(req, res)) return;

  try {
    const gameId = String(req.body?.gameId || "");
    const product = PRODUCTS[gameId];
    if (!product) {
      return res.status(400).json({ error: "Invalid product" });
    }

    const secretKey = process.env.PAYMONGO_SECRET_KEY;
    if (!secretKey) {
      return res.status(500).json({ error: "Payment configuration is missing" });
    }

    const response = await fetch("https://api.paymongo.com/v1/checkout_sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Basic " + Buffer.from(secretKey + ":").toString("base64")
      },
      body: JSON.stringify({
        data: {
          attributes: {
            billing: { name: "Customer", email: "customer@example.com" },
            send_email_receipt: false,
            show_description: true,
            show_line_items: true,
            line_items: [{
              currency: "PHP",
              amount: product.amount,
              name: product.name,
              quantity: 1
            }],
            payment_method_types: ["qrph"],
            success_url: "https://raymond-apk-store.web.app/download.html",
            cancel_url: "https://raymond-apk-store.web.app/index.html"
          }
        }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("PayMongo checkout failed:", response.status, data?.errors?.[0]?.code || "unknown");
      return res.status(502).json({ error: "Unable to create PayMongo checkout" });
    }
    return res.status(200).json(data);
  } catch (err) {
    console.error("PayMongo checkout error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
}
