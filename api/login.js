// Proxy de login: valida usuario/contraseña en Apps Script (que lee la pestaña "usuarios").
export default async function handler(req, res) {
  const URL = process.env.APPSCRIPT_URL;
  const SECRET = process.env.APP_SECRET;
  if (!URL || !SECRET) {
    return res.status(500).json({ ok: false, error: "Faltan variables de entorno APPSCRIPT_URL / APP_SECRET" });
  }
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Método no permitido" });
  try {
    const body = req.body || {};
    const r = await fetch(URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "login", secret: SECRET, usuario: body.usuario, password: body.password })
    });
    const data = await r.json();
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
