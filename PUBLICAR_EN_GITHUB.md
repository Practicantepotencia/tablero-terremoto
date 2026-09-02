# Publicar el tablero como página web pública (GitHub Pages + GitHub Actions)

Con esto, el tablero queda en una URL real tipo `https://TU_USUARIO.github.io/tablero-terremoto/`, y se actualiza solo cada 4 horas **corriendo en los servidores de GitHub** — ya no depende de que tu computador esté encendido.

## 0. Antes de empezar

Confirma que tu repositorio en GitHub existe de verdad y lo puedes ver en el navegador (si veníamos con el error "Repository not found", resuélvelo primero). Tiene que estar en **Public**, no en Private — es requisito para que GitHub Pages y las horas de Actions salgan gratis.

## 1. Agrega estos dos archivos nuevos a tu carpeta local

Copia dentro de `C:\Users\danie\OneDrive\Desktop\tablero-terremoto`:

- La carpeta **`.github`** completa (con `.github\workflows\actualizar.yml` adentro) — respeta esa estructura de carpetas exactamente, GitHub solo reconoce workflows si están en esa ruta.
- **`.gitignore`**

Tu carpeta debería quedar así:

```
tablero-terremoto/
├── .github/
│   └── workflows/
│       └── actualizar.yml
├── .gitignore
├── actualizar_indice_terremoto.py
├── actualizar_tablero.bat
└── INSTRUCCIONES.md
```

## 2. Súbelo a GitHub

En esa misma PowerShell, dentro de la carpeta del repo:

```
git add .
git commit -m "agregar publicación automática con GitHub Actions"
git push
```

## 3. Activa GitHub Pages

En la página de tu repo en github.com: **Settings** → en el menú de la izquierda, **Pages** → en "Build and deployment" → **Source: Deploy from a branch** → **Branch: main**, carpeta **/ (root)** → **Save**.

Todavía no va a mostrar nada porque `index.html` aún no existe en el repo — eso lo crea el workflow en el siguiente paso.

## 4. Corre el workflow una vez a mano (para no esperar 4 horas)

En la página del repo: pestaña **Actions** → en la lista de la izquierda, clic en **"Actualizar tablero de impacto"** → botón **"Run workflow"** (arriba a la derecha) → **Run workflow** de nuevo para confirmar.

Espera ~30-60 segundos y recarga la página. Debería aparecer una corrida con un check ✅ verde. Si sale con una ❌ roja, entra a esa corrida y revisa el log del paso "Generar tablero e índice" — el error que salga ahí es el mismo tipo de mensaje que verías corriéndolo en tu propia PowerShell.

Esa corrida, si sale bien, hace un commit automático con `index.html` y `indice_impacto_departamento.csv` — o sea que después de este paso ya deberían existir esos dos archivos en tu repo (revisa el código del repo en GitHub, deberías verlos listados).

## 5. Encuentra tu URL pública

Vuelve a **Settings → Pages** — arriba debería decir algo como "Your site is live at `https://TU_USUARIO.github.io/tablero-terremoto/`". Esa es la URL que le puedes compartir a cualquiera.

(La primera vez que activas Pages puede tardar 1-2 minutos en quedar disponible después del primer despliegue, aunque el mensaje ya diga "live".)

## Notas

- **Frecuencia real:** GitHub no garantiza que el cron corra exactamente cada 4 horas al minuto — en momentos de mucha carga en sus servidores lo puede atrasar un poco (minutos, no horas). Para este caso no importa.
- **Repos inactivos:** si el repositorio no tiene ningún cambio en 60 días, GitHub apaga automáticamente los workflows programados (no los borra, solo los pausa) — como este mismo workflow hace commits cada vez que corre, en la práctica nunca se cuenta como "inactivo", así que no debería pasar.
- **Costo:** en un repo público, los minutos de GitHub Actions son gratis sin límite práctico para algo tan liviano como esto (el job tarda unos segundos). GitHub Pages también es gratis para repos públicos.
- **Para editar la metodología** (pesos de severidad, palabras clave, etc.): sigue siendo el mismo `actualizar_indice_terremoto.py` — lo editas, haces `git push`, y la próxima corrida del workflow ya usa la versión nueva. No hace falta tocar el `.yml`.
