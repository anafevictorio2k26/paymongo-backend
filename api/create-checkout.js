export default async function handler(req, res) {
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://raymond-apk-store.web.app"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const amount = Number(req.body?.amount);

    if (
      !Number.isSafeInteger(amount) ||
      amount <= 0
    ) {
      return res.status(400).json({
        error: "Invalid amount"
      });
    }

    const secretKey = process.env.PAYMONGO_SECRET_KEY;

    if (!secretKey) {
      return res.status(500).json({
        error: "Payment configuration is missing"
      });
    }

    const response = await fetch(
      "https://api.paymongo.com/v1/checkout_sessions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:
            "Basic " +
            Buffer.from(secretKey + ":").toString("base64")
        },
        body: JSON.stringify({
          data: {
            attributes: {
              billing: {
                name: "Test Customer",
                email: "test@example.com"
              },
              send_email_receipt: false,
              show_description: true,
              show_line_items: true,
              line_items: [
                {
                  currency: "PHP",
                  amount,
                  name: "APK Purchase",
                  quantity: 1
                }
              ],
              payment_method_types: ["qrph"],
              success_url:
                "https://raymond-apk-store.web.app/download.html",
              cancel_url:
                "https://raymond-apk-store.web.app/index.html"
            }
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("PayMongo request failed:", response.status);

      return res.status(502).json({
        error: "Unable to create checkout session"
      });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("Checkout error:", err.message);

    return res.status(500).json({
      error: "Internal server error"
    });
  }
}
