// Proxy seguro Vercel -> Apps Script. Requiere token de sesión (header x-sesion).
export default async function handler(req, res) {
  const URL = process.env.APPSCRIPT_URL;
  const SECRET = process.env.APP_SECRET;
  if (!URL || !SECRET) {
    return res.status(500).json({ ok: false, error: "Faltan variables de entorno APPSCRIPT_URL / APP_SECRET" });
  }
  const token = req.headers["x-sesion"] || "";
  try {
    if (req.method === "GET") {
      const u = `${URL}?action=get&secret=${encodeURIComponent(SECRET)}&token=${encodeURIComponent(token)}`;
      const r = await fetch(u);
      const data = await r.json();
      return res.status(200).json(data);
    }
    if (req.method === "POST") {
      const state = req.body && req.body.state ? req.body.state : (req.body || {});
      const r = await fetch(URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "save", secret: SECRET, token, state })
      });
      const data = await r.json();
      return res.status(200).json(data);
    }
    return res.status(405).json({ ok: false, error: "Método no permitido" });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
