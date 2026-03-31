// Required Vercel environment variables:
// - RESEND_API_KEY
// - CONTACT_FROM_EMAIL
// Optional:
// - CONTACT_RECIPIENT

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeBody(body) {
  if (!body) {
    return {};
  }

  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch (error) {
      return {};
    }
  }

  return body;
}

function asText(value) {
  return String(value ?? "").trim();
}

function emailCopy(lang) {
  if (lang === "en") {
    return {
      title: "New website request",
      message: "Message",
      empty: "-",
      fields: {
        name: "Name / company",
        email: "Email",
        phone: "Phone",
        site: "Site / location",
        equipment: "Equipment concerned",
        equipmentCount: "Number of equipment items",
        deadline: "Requested timeframe",
        requestType: "Request type"
      }
    };
  }

  return {
    title: "Nouvelle demande site web",
    message: "Message",
    empty: "\u2014",
    fields: {
      name: "Nom / structure",
      email: "Email",
      phone: "T\u00E9l\u00E9phone",
      site: "Site / localisation",
      equipment: "\u00C9quipement concern\u00E9",
      equipmentCount: "Nombre d'\u00E9quipements",
      deadline: "\u00C9ch\u00E9ance souhait\u00E9e",
      requestType: "Type de demande"
    }
  };
}

function buildSubject(payload) {
  if (payload.lang === "en") {
    return `Website request \u2014 ${payload.requestType || "Contact"} \u2014 ${payload.name || "No name"}`;
  }

  return `Demande via le site \u2014 ${payload.requestType || "Contact"} \u2014 ${payload.name || "Sans nom"}`;
}

function buildText(payload) {
  const copy = emailCopy(payload.lang);

  return [
    `${copy.fields.name}: ${payload.name}`,
    `${copy.fields.email}: ${payload.email}`,
    `${copy.fields.phone}: ${payload.phone}`,
    `${copy.fields.site}: ${payload.site}`,
    `${copy.fields.equipment}: ${payload.equipment}`,
    `${copy.fields.equipmentCount}: ${payload.equipmentCount}`,
    `${copy.fields.deadline}: ${payload.deadline}`,
    `${copy.fields.requestType}: ${payload.requestType}`,
    "",
    `${copy.message}:`,
    payload.message
  ].join("\n");
}

function buildHtml(payload) {
  const copy = emailCopy(payload.lang);
  const rows = [
    [copy.fields.name, payload.name],
    [copy.fields.email, payload.email],
    [copy.fields.phone, payload.phone],
    [copy.fields.site, payload.site],
    [copy.fields.equipment, payload.equipment],
    [copy.fields.equipmentCount, payload.equipmentCount],
    [copy.fields.deadline, payload.deadline],
    [copy.fields.requestType, payload.requestType]
  ];

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0d1220">
      <h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(copy.title)}</h1>
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px">
        <tbody>
          ${rows
            .map(
              ([label, value]) => `
                <tr>
                  <td style="padding:8px 12px;border:1px solid #d8dee9;background:#f7f9fc;font-weight:700;width:220px">${escapeHtml(label)}</td>
                  <td style="padding:8px 12px;border:1px solid #d8dee9">${escapeHtml(value || copy.empty)}</td>
                </tr>`
            )
            .join("")}
        </tbody>
      </table>
      <h2 style="font-size:16px;margin:0 0 8px">${escapeHtml(copy.message)}</h2>
      <div style="padding:16px;border:1px solid #d8dee9;border-radius:12px;background:#ffffff;white-space:pre-wrap">${escapeHtml(payload.message || "")}</div>
    </div>
  `;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const payload = normalizeBody(req.body);
  const website = asText(payload.website);

  if (website) {
    return res.status(200).json({ ok: true, message: "Request received." });
  }

  const normalized = {
    lang: asText(payload.lang) === "en" ? "en" : "fr",
    name: asText(payload.name),
    email: asText(payload.email),
    phone: asText(payload.phone),
    site: asText(payload.site),
    equipment: asText(payload.equipment),
    equipmentCount: asText(payload.equipmentCount),
    deadline: asText(payload.deadline),
    requestType: asText(payload.requestType),
    message: asText(payload.message),
    consent: Boolean(payload.consent)
  };

  if (!normalized.name || !normalized.email || !normalized.message || !normalized.consent) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  const resendApiKey = asText(process.env.RESEND_API_KEY);
  const fromEmail = asText(process.env.CONTACT_FROM_EMAIL);
  const recipient = asText(process.env.CONTACT_RECIPIENT) || "contact@control-air.fr";

  if (!resendApiKey || !fromEmail) {
    return res.status(503).json({ error: "Contact delivery is not configured on the server." });
  }

  let response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipient],
        reply_to: normalized.email,
        subject: buildSubject(normalized),
        text: buildText(normalized),
        html: buildHtml(normalized)
      })
    });
  } catch (error) {
    return res.status(502).json({
      error: "Email delivery failed.",
      details: error instanceof Error ? error.message : String(error)
    });
  }

  if (!response.ok) {
    const details = await response.text();
    return res.status(502).json({ error: "Email delivery failed.", details });
  }

  return res.status(200).json({
    ok: true,
    message: normalized.lang === "en"
      ? "Your request has been sent successfully. We will get back to you shortly."
      : "Votre demande a bien \u00E9t\u00E9 transmise. Nous reviendrons vers vous rapidement."
  });
};
