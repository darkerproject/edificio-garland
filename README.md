# Gestor de alquileres

App de control de ingresos (alquileres) y gastos de un edificio.
Front en React (Vite) desplegado en Vercel; base de datos en Google Sheets vía Google Apps Script.

## Arquitectura

```
[Vercel]  front React  +  /api/data (función serverless, guarda el SECRET)
   |                          |
   |  fetch /api/data         |  reenvía con el SECRET
   v                          v
 navegador            [Apps Script /exec]  ->  [Google Sheets]
```

El navegador nunca ve el SECRET: la función `/api/data.js` lo agrega por detrás y
reenvía a Apps Script. Eso también evita problemas de CORS.

## Cómo desplegar

1. Sube esta carpeta a un repositorio de GitHub.
2. En Vercel: **Add New… → Project → Import** ese repo. Detecta Vite solo.
3. Antes de desplegar (o en Settings → Environment Variables) agrega DOS variables:
   - `APPSCRIPT_URL` = la URL de tu Web App de Apps Script (la que termina en `/exec`)
   - `APP_SECRET` = la MISMA clave que pusiste en la variable `SECRET` de `Api.gs`
4. **Deploy**. Listo.

## Desarrollo local (opcional)

```
npm install
npm run dev
```
Para que `/api/data` funcione en local usa `vercel dev` (CLI de Vercel) con las
variables de entorno, o prueba directamente en el despliegue de Vercel.

## Notas

- Si ves la pantalla «No se pudo conectar con la base de datos», casi siempre es
  que faltan las variables de entorno en Vercel o que la Web App no está publicada
  con acceso «Cualquier usuario».
- Los datos se guardan automáticamente ~1 segundo después de cada cambio
  (aparece «Guardando…» abajo a la derecha).
