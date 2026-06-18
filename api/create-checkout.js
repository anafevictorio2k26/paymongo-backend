export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const amount = Number(req.body.amount);

    const response = await fetch(
      "https://api.paymongo.com/v1/checkout_sessions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:
            "Basic " +
            Buffer.from(
              process.env.PAYMONGO_SECRET_KEY + ":"
            ).toString("base64"),
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
                  amount: amount,
                  name: "APK Purchase",
                  quantity: 1
                }
              ],
              payment_method_types: ["qrph"],
              success_url: "https://raymond-apk-store.web.app/download.html",
              cancel_url: "https://raymond-apk-store.web.app/index.html"
            }
          }
        })
      }
    );

    const data = await response.json();

    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
}
