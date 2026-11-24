# UNIFORMA Panel interno para Hostinger

## Versión integral 2.1

### Ampliación del 27/08/2026

- Ordena automáticamente talles de indumentaria, talles especiales y talles numéricos aunque WooCommerce los entregue alfabéticamente.
- Permite ingresar cualquier cantidad desde 1 unidad y aplica automáticamente el precio del tramo correspondiente.
- Cada logo guarda su propia técnica, color, lado, ubicación e indicaciones de producción.
- Incorpora vistas independientes de frente y espalda en el editor.
- Elimina el control de opacidad.
- Agrega eliminación local de fondos uniformes con posibilidad de deshacer.
- Amplía los pagos con edición, referencia, comprobante, estado de cobranza y saldo a favor.

### Corrección validada el 31/07/2026

- Corrige el envío de los formularios de clientes, productos, propuestas, tareas y usuarios.
- Guarda únicamente las secciones modificadas, evitando reenviar logos e imágenes ajenos a cada operación.
- Mantiene compatibilidad con el guardado completo de versiones anteriores.
- Mejora los mensajes cuando PHP rechaza una solicitud por tamaño o por JSON inválido.
- Sincroniza el catálogo usando cURL cuando está disponible y conserva el método alternativo de PHP.
- Corrige los productos sincronizados sin talles para que ofrezcan los talles predeterminados.

Para actualizar una instalación existente, reemplace los archivos del panel pero conserve una copia de la carpeta `data/`. Después recargue el navegador con `Ctrl + F5`.

Esta versión mantiene los clientes, productos, usuarios y propuestas ya guardados y amplía el panel con:

- múltiples propuestas por cliente y múltiples prendas por propuesta;
- editor visual con logos ilimitados, capas, movimiento, ancho, alto, rotación, opacidad, duplicado y deshacer/rehacer;
- precios para 5, 10, 20 y 50 unidades, colores, talles, métodos y tabla de talles por producto;
- estados de venta y producción, vencimientos, prioridades, tareas y notificaciones desplegables;
- señas y pagos parciales con saldo restante automático;
- historial, duplicación, papelera recuperable y copias automáticas de los últimos 20 estados;
- propuesta comercial imprimible o guardable como PDF y envío por WhatsApp.

Al reemplazar una instalación existente, conserve la carpeta `data/` actual. El panel migra los datos anteriores al abrirlos y crea respaldos automáticos dentro de `data/backups/`.

Carpeta lista para subir a `uniforma.com.ar/panel/` o a `panel.uniforma.com.ar`.

## Acceso inicial

El panel ya no trae usuario ni contraseña por defecto. La primera vez que se abre una instalación nueva
(sin `data/users.json`) muestra la pantalla **Crear administrador**: ahí se elige usuario y contraseña
(mínimo 10 caracteres). Si querés limitar quién puede crear ese primer usuario, definí `setup_key` en
`config.local.php`. Las instalaciones existentes conservan sus usuarios; las claves antiguas (SHA-256) se
convierten solas a bcrypt la próxima vez que cada persona inicia sesión.

## Que incluye esta version

- Login interno con sesiones PHP.
- Usuarios multiples.
- Roles y permisos por seccion.
- Tareas, recordatorios y alertas de seguimiento.
- Fichas de cliente con prioridad, origen, notas y datos de contacto ampliados.
- Pipeline comercial por estado de propuesta.
- Impresion / guardado PDF de propuestas desde el navegador.
- Catalogo editable desde el panel.
- Carga de imagen frente y espalda desde archivo, sin tocar carpetas.
- Borrado de productos y clientes con permisos.
- Permisos ajustables por usuario.
- Reportes comerciales y de produccion.
- Auditoria de actividad reciente.
- Configuracion visual: colores y densidad.
- Configuracion comercial: moneda, margen, impuesto, validez y dias de produccion.
- Exportacion e importacion de backup JSON.
- Datos guardados en archivos JSON protegidos dentro de `data/`.
- Logos reales de UNIFORMA integrados en login, menu lateral y propuestas impresas.

## Subida rapida en Hostinger

1. Subir el ZIP o el contenido de esta carpeta a `public_html/panel`.
2. Extraerlo de forma que `index.php` quede directamente dentro de `public_html/panel`.
3. Verificar que exista la carpeta `data` y que tenga permisos de escritura.
4. Abrir `https://uniforma.com.ar/panel/`.
5. Entrar con el usuario inicial.

La estructura correcta es:

```text
public_html/panel/index.php
public_html/panel/api.php
public_html/panel/panel.css
public_html/panel/panel.js
public_html/panel/assets/
public_html/panel/assets/brand/
public_html/panel/data/
```

## Seguridad incluida

- Login obligatorio.
- Permisos verificados tambien en el servidor.
- `X-Robots-Tag` y `meta robots` para evitar indexacion.
- Carpeta `data` protegida con `.htaccess`.
- `config.php` y `bootstrap.php` protegidos con `.htaccess`.
- Guardado con bloqueo de escritura para evitar pisadas simultaneas simples.

## Usuarios y permisos

Roles disponibles:

- `Administrador`: acceso total, usuarios y configuracion.
- `Gerente comercial`: ventas, clientes, catalogo, reportes y configuracion.
- `Vendedor`: clientes, propuestas, editor y reportes.
- `Diseno / produccion`: editor, propuestas, catalogo y reportes.
- `Solo lectura`: consulta sin modificar.

## Nota importante

Esta version ya sirve como panel interno profesional para salir rapido. Cuando el flujo este validado y haya mas uso real, conviene migrar datos a MySQL para historiales mas grandes, backups automaticos y reportes avanzados.


## Sincronización con WooCommerce

Esta entrega incluye un botón **Sincronizar con la web** dentro de Productos. La web expone un endpoint privado y el panel lo consulta con un token compartido. Para que funcione, suba juntos el theme y el panel incluidos en esta entrega.

Si clientes u órdenes no se guardan, asigne permisos `775` a `public_html/panel/data` y `664` a `state.json` y `users.json`. El panel ahora muestra un mensaje explícito cuando detecta este problema.
