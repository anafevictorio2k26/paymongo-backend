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
    const orderID = String(req.body?.orderID || "");
    if (!/^[A-Z0-9-]{10,}$/i.test(orderID)) {
      return res.status(400).json({ error: "Invalid PayPal order ID" });
    }

    const accessToken = await getPayPalAccessToken();
    const orderResponse = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${encodeURIComponent(orderID)}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const order = await orderResponse.json();
    if (!orderResponse.ok || !order.id) {
      return res.status(400).json({ error: "PayPal order could not be verified" });
    }

    
const unit = order.purchase_units?.[0];

const gameId = String(
  unit?.custom_id || unit?.reference_id || ""
);

const product = PRODUCTS[gameId];

const expectedAmount = product
  ? product.amount
  : null;

const actualAmount = Number(unit?.amount?.value);
const actualAmountCentavos = Number.isFinite(actualAmount)
  ? Math.round(actualAmount * 100)
  : null;

const checks = {
  productFound: Boolean(product),
  gameId,
  intent: order.intent,
  status: order.status,
  currency: unit?.amount?.currency_code,
  actualAmountCentavos,
  expectedAmountCentavos: expectedAmount
};

if (
  !product ||
  order.intent !== "CAPTURE" ||
  order.status !== "APPROVED" ||
  unit?.amount?.currency_code !== "PHP" ||
  actualAmountCentavos !== expectedAmount
) {
  console.error("PayPal validation failed:", checks);

  return res.status(400).json({
    error: "PayPal order validation failed. Check Vercel function logs."
  });
}
   
    const captureResponse = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${encodeURIComponent(orderID)}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: "{}"
    });
    const captureData = await captureResponse.json();
    if (!captureResponse.ok) {
      // If a previous request already captured it, the caller can retry only after checking PayPal's order status.
      console.error("PayPal capture failed:", captureResponse.status, captureData?.name || "unknown");
      return res.status(502).json({ error: "Unable to capture PayPal payment" });
    }

    const capturedUnit = captureData.purchase_units?.[0];
    const capture = capturedUnit?.payments?.captures?.[0];
    if (captureData.status !== "COMPLETED" || capture?.status !== "COMPLETED" ||
        capturedUnit?.custom_id !== product.id ||
        capture?.amount?.currency_code !== "PHP" || capture?.amount?.value !== expectedAmount) {
      return res.status(402).json({ error: "PayPal payment is not confirmed" });
    }

    return res.status(200).json({
      success: true,
      gameId: product.id,
      productName: product.name,
      orderID: captureData.id
    });
  } catch (err) {
    console.error("PayPal capture error:", err.message);
    return res.status(500).json({ error: "Unable to verify PayPal payment" });
  }
}
