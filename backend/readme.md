## Estructura final en tu proyecto

Listado de rutas de carpetas para el volumen Windows
El n·mero de serie del volumen es 000000FF A025:E3A0
C:.
|   .gitignore
|   output.doc
|   
+---.github
|   \---workflows
|           deploy-frontend.yml
|           
+---app-tiendas
|   |   index-tienda.html
|   |   login-tienda.html
|   |   manifest-tienda.json
|   |   sw-tienda.js
|   |   
|   \---assets
|       +---css
|       |       tiendas.css
|       |       
|       +---img
|       |       icon-128x128.png
|       |       icon-144x144.png
|       |       icon-152x152.png
|       |       icon-192x192.png
|       |       icon-384x384.png
|       |       icon-512x512.png
|       |       icon-72x72.png
|       |       icon-96x96.png
|       |       Logo_tienda.png
|       |       og-domi-tiendas.jpg
|       |       
|       \---js
|               config-tienda.js
|               notificaciones-tienda.js
|               push-manager-tienda.js
|               tiendas.js
|               
+---backend
|   |   .env
|   |   package-lock.json
|   |   package.json
|   |   railway.json
|   |   readme.md
|   |   server.js
|   |   tiendaRoutes.js
|   |   
|   +---middleware
|   |       verifyTienda.js
|   |       
|   \---routes
|           tiendaRoutes.js
|           trabajaRoutes.js
|           
+---docs
|       Acuerdo de Alianza Comercial - DOMIDELIS.pdf
|       afiche.pdf
|       anunciooficial.mp4
|       documentacion-tecnica-domidelis.pdf
|       DOMIDELIS_Documentacion_Tecnica_PWA.docx
|       DOMIDELIS_Documentacion_Tecnica_PWA.pdf
|       Grabaci¾n de pantalla 2026-06-23 194617 - Converted with FlexClip.mp3
|       imagen_din codigo.pdf
|       lanzamiento.png
|       lanzamiento_sin_codigo_bordes.png
|       Manual_Usuario_DOMIDELIS.docx
|       output.doc
|       
\---frontend
    |   admin.html
    |   checkout.html
    |   confirmacion.html
    |   contrato.html
    |   domiciliario.html
    |   index.html
    |   login-cliente.html
    |   login.html
    |   manifest.json
    |   service-worker.js
    |   
    +---assets
    |   +---css
    |   |       anuncios.css
    |   |       domiciliario.css
    |   |       informe.css
    |   |       notificaciones.css
    |   |       offline-game.css
    |   |       propina.css
    |   |       resumen-tienda.css
    |   |       styles.css
    |   |       trabaja.css
    |   |       
    |   +---img
    |   |   |   anuncio1.png
    |   |   |   favicon-32x32.png
    |   |   |   fo.html
    |   |   |   icon-128x128.png
    |   |   |   icon-144x144.png
    |   |   |   icon-152x152.png
    |   |   |   icon-192x192.png
    |   |   |   icon-384x384.png
    |   |   |   icon-512x512.png
    |   |   |   icon-72x72.png
    |   |   |   icon-96x96.png
    |   |   |   logo.png
    |   |   |   metas.jpg
    |   |   |   metas.png
    |   |   |   tienda-error.png
    |   |   |   
    |   |   \---categorias
    |   |           almuerzo.png
    |   |           bebidas.png
    |   |           cervezas.png
    |   |           comida.png
    |   |           farmacia.png
    |   |           icons8-cigarettes-pack-50.png
    |   |           licores.png
    |   |           todas.png
    |   |           
    |   +---js
    |   |   |   admin-anuncios.js
    |   |   |   admin.js
    |   |   |   anuncios.js
    |   |   |   auth-guard.js
    |   |   |   auth.js
    |   |   |   checkout.js
    |   |   |   client.js
    |   |   |   config.js
    |   |   |   domiciliario.js
    |   |   |   info-domi.js
    |   |   |   informe-financiero.js
    |   |   |   notificaciones.js
    |   |   |   offline-game.js
    |   |   |   push-manager.js
    |   |   |   sw-register.js
    |   |   |   trabaja.js
    |   |   |   
    |   |   \---components
    |   |           toast.js
    |   |           
    |   \---sounds
    |           alerta.aac
    |           
    +---data
    |       catalogo.json
    |       
    \---pages
            centro-de-ayuda.html
            politicas.html
            terminos.html
            trabaja-con-nosotros.html
            TyC.html



            FLUJO 1 — EL CLIENTE PIDE
            Abre la app
    ↓
Carga el hero, categorías, tiendas (desde Google Sheets vía API)
    ↓
Elige zona en el autocomplete (zonas también vienen de Sheets)
    ↓
Desliza categorías o ve todas las tiendas
    ↓
Toca una tienda
    ↓
Carga el menú de esa tienda (productos desde Sheets)
    ↓
Toca "Agregar" en un producto
    ↓
¿Tiene complementos?
    ├── SÍ → Abre modal → Elige salsas/extras → Agrega al carrito
    └── NO → Va directo al carrito
    ↓
Sigue comprando o abre el carrito
    ↓
Revisa su pedido (puede cambiar cantidades, eliminar)
    ↓
Toca "Continuar con el pedido"
    ↓
Pantalla de checkout
    ├── Confirma o elige zona
    ├── Elige método de pago
    └── Toca "Enviar pedido por WhatsApp"
    ↓
Se abre WhatsApp con el mensaje armado
    ↓
Cliente envía el mensaje
    ↓
FIN DEL PROCESO DEL CLIENTE


FLUJO 2 — NACE EL PEDIDO (LO MANUAL)
WhatsApp recibe el mensaje
    ↓
Alguien (¿quién?) lee el mensaje
    ↓
¿Quién lo registra en el sistema?
    ↓
Alguien lo digita manualmente en el panel de admin
    ↓
El pedido queda guardado en Google Sheets (hoja "Pedidos")
    ↓
Socket.io detecta que hay un pedido nuevo
    ↓
Socket.io notifica en tiempo real a admin y tiendas


FLUJO 3 — LA TIENDA RECIBE EL PEDIDO
Socket.io notifica a la tienda
    ↓
La tienda ve el pedido en su panel
    ↓
La tienda lo revisa: productos, adiciones, cantidad
    ↓
¿La tienda lo acepta?
    ├── SÍ → Cambia estado a "Aceptado" → Se notifica al admin
    └── NO → Cambia estado a "Rechazado" → Se notifica al admin → ¿Se le avisa al cliente?
    ↓
La tienda prepara el pedido físicamente
    ↓
La tienda cambia estado a "Listo para recoger"
    ↓
Se notifica al admin y al domiciliario

FLUJO 4 — EL ADMIN ASIGNA DOMICILIARIO
Admin ve que hay un pedido "Aceptado" o "Listo para recoger"
    ↓
Admin abre el modal de asignar domiciliario
    ↓
Admin busca un domiciliario disponible
    ↓
¿Hay domiciliarios disponibles?
    ├── SÍ → Admin asigna
    └── NO → EL PEDIDO SE QUEDA TRABADO AQUÍ
    ↓
Se notifica al domiciliario asignado
    ↓
El domiciliario ve el pedido en su panel


FLUJO 5 — EL DOMICILIARIO HACE EL RECORRIDO
Domiciliario ve el pedido asignado
    ↓
Revisa: tienda, dirección del cliente, productos, adiciones
    ↓
Va a la tienda
    ↓
Verifica que todo esté correcto en la bolsa
    ↓
¿Todo está bien?
    ├── SÍ → Cambia estado a "En camino"
    └── NO → Reporta problema → ¿a quién? → ¿qué hace el sistema?
    ↓
Se dirige a la dirección del cliente
    ↓
Llega al destino
    ↓
Entrega el pedido
    ↓
Cobra si es efectivo
    ↓
Cambia estado a "Entregado"
    ↓
Se notifica al admin
Admin ve que el pedido está "Entregado"
    ↓
¿El domiciliario cobra comisión?
    ↓
¿Esa comisión se registra en el sistema?
    ↓
¿El dinero del domicilio se le paga a la tienda o al domiciliario lo cobra aparte?
    ↓
¿El historial sirve para algo además de verlo?
    ↓
¿Hay reportes de ventas? ¿De tiempos de entrega? ¿De tiendas más pedidas?