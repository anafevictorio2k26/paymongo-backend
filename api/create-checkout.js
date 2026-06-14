export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { amount } = req.body;

    const response = await fetch("https://api.paymongo.com/v1/checkout_sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + Buffer.from(process.env.PAYMONGO_SECRET_KEY + ":").toString("base64")
      },
      body: JSON.stringify({
        data: {
          attributes: {
            amount: amount,
            currency: "PHP",
            payment_method_types: ["gcash", "card"],
            success_url: "https://your-firebase-site.web.app/download.html",
            cancel_url: "https://your-firebase-site.web.app/cancel.html"
          }
        }
      })
    });

    const data = await response.json();

    return res.status(200).json({
      checkout_url: data.data.attributes.checkout_url
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
