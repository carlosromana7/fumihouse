# 🪲 FumiHouse — Agenda de servicios

Agenda web para servicios de fumigación: clientes, servicios, cobros, servicios recurrentes,
avisos por Telegram y sincronización con Google Calendar / iPhone.

**Tecnología:** GitHub Pages (página) + Supabase (base de datos, login, funciones).

```
agenda-fumigacion/
├── index.html                     ← la aplicación
├── img/                           ← logo e ícono FumiHouse
├── css/styles.css
├── js/config.js                   ← TUS DATOS de Supabase (paso 3)
├── js/app.js
└── supabase/
    ├── schema.sql                 ← tablas (paso 1)
    ├── cron.sql                   ← avisos automáticos (paso 6)
    └── functions/
        ├── avisos/index.ts        ← avisos por Telegram
        └── calendario/index.ts    ← enlace .ics para tu calendario
```

---

## Paso 1 — Crear la base de datos en Supabase

1. Entra a https://supabase.com → **New project** (región: São Paulo, la más cercana).
2. Ve a **SQL Editor** → **New query** → pega todo `supabase/schema.sql` → **Run**.
3. Revisa en **Table Editor** que existan `clientes` y `servicios`.

## Paso 2 — Crear tu usuario

1. **Authentication → Users → Add user → Create new user**.
2. Pon tu correo y una contraseña, marca **Auto Confirm User**.
3. En **Authentication → Sign In / Providers**, desactiva **Allow new users to sign up**
   (así nadie más puede crearse una cuenta).

## Paso 3 — Configurar la página

1. En Supabase: **Project Settings → API**. Copia **Project URL** y la clave **anon public**.
2. Abre `js/config.js` y reemplaza `TU_PROYECTO` y `TU_ANON_KEY`.

> La anon key puede estar en GitHub. La **service_role** NUNCA va en el repositorio.

## Paso 4 — Publicar en GitHub Pages

1. Crea un repositorio en GitHub, por ejemplo `agenda-fumigacion`.
2. Sube los archivos:
   ```bash
   git init
   git add .
   git commit -m "Agenda fumigación"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/agenda-fumigacion.git
   git push -u origin main
   ```
3. En GitHub: **Settings → Pages → Source: Deploy from a branch → main / (root) → Save**.
4. En 1–2 minutos queda en `https://TU_USUARIO.github.io/agenda-fumigacion/`.
5. Entra con tu correo y contraseña. Crea un cliente y un servicio de prueba.

> En el celular: abre la página y usa "Agregar a pantalla de inicio" para tenerla como app.

## Paso 5 — Crear el bot de Telegram

1. En Telegram busca **@BotFather** → `/newbot` → ponle nombre → copia el **token**.
2. Abre tu bot y envíale cualquier mensaje (ej. "hola").
3. En el navegador abre: `https://api.telegram.org/botTU_TOKEN/getUpdates`
   y busca `"chat":{"id":123456789` → ese número es tu **chat_id**.

## Paso 6 — Subir las funciones a Supabase

Necesitas la CLI de Supabase (una sola vez):
```bash
npm install -g supabase        # o: npx supabase ...
supabase login
supabase link --project-ref TU_PROYECTO
```

Guarda las claves secretas (inventa CAL_TOKEN: una clave larga al azar, ej. de 32 caracteres):
```bash
supabase secrets set TELEGRAM_TOKEN=xxxx TELEGRAM_CHAT_ID=123456789 CAL_TOKEN=una_clave_larga_inventada
```

Despliega las funciones:
```bash
supabase functions deploy avisos
supabase functions deploy calendario --no-verify-jwt
```

Activa los avisos automáticos:
1. **Database → Extensions** → activa `pg_cron` y `pg_net`.
2. Abre `supabase/cron.sql`, reemplaza `TU_PROYECTO` y `TU_SERVICE_ROLE_KEY`
   (Project Settings → API → service_role), y ejecútalo en el **SQL Editor**.

**Prueba:** crea un servicio para dentro de 1 hora → en máx. 15 min te llega el aviso a Telegram.

## Paso 7 — Sincronizar con tu calendario

1. En la app, pestaña **🔗 Calendario** → escribe tu `CAL_TOKEN` → **Guardar clave**.
2. **Google Calendar:** copia el enlace → en calendar.google.com (computadora)
   → "Otros calendarios" → **+** → **Desde URL** → pega → Añadir calendario.
3. **iPhone:** toca **📱 Abrir en iPhone** → Suscribirse.
4. **Descargar:** botón **⬇️ Descargar .ics** (para importar una vez o enviar).

> Google actualiza calendarios suscritos cada varias horas. Para avisos a tiempo, usa Telegram.
> El calendario es solo de lectura: los cambios se hacen siempre en la app.

---

## Cómo se usa

- **Agenda:** ves hoy / semana / próximos, con totales y lo que falta cobrar.
- Botones por servicio: **Llamar, WhatsApp** (mensaje de confirmación listo), **Mapa**,
  **Confirmar, Realizado, Cobrado, Editar**.
- **Servicios recurrentes:** elige "Repetir cada 3 meses". Al marcar **Realizado**,
  se crea solo el próximo servicio.
- Si cambias la fecha de un servicio, los avisos de Telegram se vuelven a enviar.

## Problemas comunes

| Problema | Solución |
|---|---|
| Página en blanco | Revisa `js/config.js` (URL y anon key) |
| "Correo o contraseña incorrectos" | Usuario sin "Auto Confirm" o contraseña errada |
| No llegan avisos | `select * from cron.job_run_details order by start_time desc limit 10;` y revisa logs en Edge Functions → avisos |
| Calendario da 401 | El token en la app no coincide con `CAL_TOKEN` |
