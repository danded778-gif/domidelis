## Estructura final en tu proyecto

```
frontend/
    trabaja-con-nosotros.html    <-- NUEVO
    index.html
    ...
    assets/
        css/
            trabaja.css          <-- NUEVO
            styles.css
            ...
        js/
            trabaja.js           <-- NUEVO
            config.js
            ...
            
backend/
    server.js                    <-- MODIFICAR (agregar 2 lineas)
    routes/
        trabajaRoutes.js         <-- NUEVO
        tiendaRoutes.js
        ...
    .env                         <-- MODIFICAR (agregar CORREO_DESTINO)
```


Listado de rutas de carpetas para el volumen Windows
El n·mero de serie del volumen es A025-E3A0
C:.
|   .gitignore
|   output.doc
|   
+---.github
|   \---workflows
|           deploy-frontend.yml
|           
+---.vscode
|       settings.json
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
|       |       
|       \---js
|               config-tienda.js
|               tiendas.js
|               
+---backend
|   |   .env
|   |   package-lock.json
|   |   package.json
|   |   railway.json
|   |   readme
|   |   server.js
|   |   
|   +---middleware
|   |       verifyTienda.js
|   |       
|   \---routes
|           tiendaRoutes.js
|           
+---docs
|       documentacion-tecnica-domidelis.pdf
|       Domidelis.png
|       DOMIDELIS_Documentacion_Tecnica_PWA.pdf
|       output.doc
|       QR domidelis.pdf
|       qr domidelis.png
|       
\---frontend
    |   admin.html
    |   checkout.html
    |   confirmacion.html
    |   domiciliario.html
    |   index.html
    |   login.html
    |   manifest.json
    |   service-worker.js
    |   
    +---assets
    |   +---css
    |   |       anuncio.css
    |   |       informe.css
    |   |       notificaciones.css
    |   |       offline-game.css
    |   |       resumen-tienda.css
    |   |       styles.css
    |   |       
    |   +---img
    |   |       favicon-32x32.png
    |   |       icon-128x128.png
    |   |       icon-144x144.png
    |   |       icon-152x152.png
    |   |       icon-192x192.png
    |   |       icon-384x384.png
    |   |       icon-512x512.png
    |   |       icon-72x72.png
    |   |       icon-96x96.png
    |   |       logo.png
    |   |       
    |   +---js
    |   |   |   admin.js
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
            TyC.html