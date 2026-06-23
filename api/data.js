// Función serverless de Vercel: proxy seguro hacia Google Apps Script.
// El SECRET vive aquí (variable de entorno), nunca en el navegador.
export default async function handler(req, res) {
  const URL = process.env.APPSCRIPT_URL;
  const SECRET = process.env.APP_SECRET;
  if (!URL || !SECRET) {
    return res.status(500).json({ ok: false, error: "Faltan variables de entorno APPSCRIPT_URL / APP_SECRET" });
  }
  try {
    if (req.method === "GET") {
      const r = await fetch(URL);
      const data = await r.json();
      return res.status(200).json(data);
    }
    if (req.method === "POST") {
      const state = req.body && req.body.state ? req.body.state : req.body;
      const r = await fetch(URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "save", secret: SECRET, state })
      });
      const data = await r.json();
      return res.status(200).json(data);
    }
    return res.status(405).json({ ok: false, error: "Método no permitido" });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
