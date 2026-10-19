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

const PAYPAL_BASE = process.env.PAYPAL_ENV === "production"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("PayPal credentials are not configured");

  const response = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    console.error("PayPal token request failed:", response.status);
    throw new Error("Unable to authenticate with PayPal");
  }
  return data.access_token;
}

export default async function handler(req, res) {
  if (!handleMethod(req, res)) return;

  try {
    const gameId = String(req.body?.gameId || "");
    const product = PRODUCTS[gameId];
    if (!product) return res.status(400).json({ error: "Invalid product" });

    const accessToken = await getPayPalAccessToken();
    const response = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: product.id,
          custom_id: product.id,
          description: product.name,
          amount: { currency_code: "PHP", value: (product.amount / 100).toFixed(2) }
        }],
        application_context: {
          brand_name: "Raymond Games Store",
          user_action: "PAY_NOW",
          return_url: "https://raymond-apk-store.web.app/paypal-return.html",
          cancel_url: "https://raymond-apk-store.web.app/index.html?paypal=cancelled"
        }
      })
    });
    const data = await response.json();
    if (!response.ok || !data.id) {
      console.error("PayPal order creation failed:", response.status, data?.name || "unknown");
      return res.status(502).json({ error: "Unable to create PayPal order" });
    }
    const approval = (data.links || []).find(link => link.rel === "approve");
    if (!approval?.href) return res.status(502).json({ error: "PayPal approval link was not returned" });
    return res.status(200).json({ orderID: data.id, approvalUrl: approval.href });
  } catch (err) {
    console.error("PayPal order error:", err.message);
    return res.status(500).json({ error: "Unable to start PayPal checkout" });
  }
}
