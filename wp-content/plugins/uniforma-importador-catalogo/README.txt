UNIFORMA · IMPORTADOR DE FOTOS · VERSIÓN 2.1.0
Edición preparada para la carga del 16/10/2026.

INSTALACIÓN Y USO
1. WordPress > Plugins > Añadir plugin > Subir plugin.
2. Subir UNIFORMA-importador-fotos-v2.1.0.zip y reemplazar la versión anterior cuando WordPress lo ofrezca. Si aparece como plugin separado, desactivar el importador anterior antes de activar este. No ejecutar ambos importadores a la vez.
3. WooCommerce > Importador UNIFORMA.
4. Revisar las filas: cada producto del paquete debe apuntar al producto correcto de la web. Las coincidencias seguras por SKU o nombre se preseleccionan. Si falta una coincidencia, buscar el producto; dejar vacío para omitirlo.
5. Presionar «Revisar coincidencias». Se informan colores inexistentes y productos sin asignar. No se crean productos, colores, talles ni variaciones.
6. Presionar «Iniciar / reanudar carga» y mantener la pestaña abierta. Ante un corte, volver a presionar el mismo botón.
7. Descargar el registro CSV y comprobar las fichas: cambiar de color, revisar frente/espalda y el personalizador. Comprobar que la remera mujer con lycra quedó en borrador.

Incluye todas las imágenes de esta carga: NO hay que subir el ZIP de 270 fotos por separado. El ZIP es un plugin instalable; no se carga en Medios.

ALCANCE
De las 270 fotos nuevas: 172 incluidas, 80 excluidas por pedido y 18 pendientes de asociación. Hay 34 productos previstos para fotos, más la remera con lycra para cambiar su estado. Cuatro imágenes de buzo se reutilizan entre el producto regular y el de talle especial: 176 asignaciones, 172 archivos únicos.
El número efectivo de productos/fotos importados depende de las coincidencias y de los colores existentes en la web. Las filas sin destino y los colores ausentes se omiten y se muestran en la revisión.

Esta edición se limita a fotos. Sustituye los modos «Solo faltantes» y «Sincronización completa» de la versión 2.0.0. No aplica el catálogo antiguo de 155 productos ni sus 906 imágenes.
Conserva nombres, descripciones, SKU, precios, categorías, stock, talles y atributos. No da de alta productos ni variaciones y no cambia otros estados.
Asocia el frente a las variaciones existentes de ese color, en todos sus talles. Agrega frente y espalda a la galería con nombres reconocibles por el tema Uniforma y actualiza _uniforma_color_image_map.
Retira de la galería las fotos anteriores identificadas del color actualizado. Conserva las de otros colores, y las imágenes auxiliares cuyo color no se identifica. Si la imagen principal no tiene color identificable, utiliza la primera foto nueva; si pertenece a otro color no actualizado, la conserva.
Los adjuntos antiguos permanecen en Medios. Los colores base no presentes entre estas 270 fotos no se regeneran ni se reemplazan.

EXCLUSIONES
- Remera clásica, incluidas sus variantes de tejido, cuello y talles especiales.
- Remera oversize.
- Remera mujer con lycra: no importar fotos; pasar únicamente ese producto a borrador.
- Chomba piqué, incluidos talles especiales.
- Buzo canguro, incluidos talles especiales.
- Campera polar, buzo polar y chaleco polar, incluidos talles especiales.
- Camisas de mujer y de hombre.
- Ambo verde con detalles rosas de la foto de apertura.
- Gorra vintage básica: TODOS los colores. El piluso vintage sí está incluido.
- Zapato Bochin.
- Los calzados previamente descartados tampoco se incorporan.
Omitir significa dejar el producto y sus fotos actuales como están; no borrarlo ni pasarlo a borrador. La única excepción de estado es la remera mujer con lycra.

PENDIENTES (18 FOTOS; NO INCLUIDAS EN LA CARGA)
- Milano azul, Mora azul, Venecia azul, Turín negro y Turín azul (10 fotos): los renders muestran conjuntos; el catálogo tiene sacos y pantalones como productos separados. Falta definir el destino o generar fotos de las piezas por separado.
- Alpargatas con guarda negras, verdes y blancas (6 fotos): confirmar si comparten ficha con las lisas o tienen SKU propio. Se incluyen las lisas.
- Gorro de chef azul de jean (2 fotos): el producto del importador especifica gabardina. Confirmar tela/modelo.
CONTENIDO.csv detalla cada asignación. PENDIENTES.csv enumera cada foto pendiente.

REANUDACIÓN Y RESPALDO
Importa en lotes de dos fotos y actualiza hasta 20 variaciones por paso. Reutiliza imágenes por SHA-256 comprobando también el archivo físico; un archivo del mismo nombre con otro contenido no se reutiliza.
Guarda antes del primer cambio la imagen principal, galería, mapa de colores, imágenes de variaciones y estado del producto. El respaldo original no se sobrescribe al reanudar o repetir.
«Descargar respaldo de asignaciones» produce un JSON para restauración técnica. No es un respaldo de toda la base de datos y no incluye un botón de restauración automática.
«Reiniciar progreso» permite revisar otra vez los destinos; no elimina productos, adjuntos ni respaldos.
Para cambiar las coincidencias de una ejecución iniciada, reiniciar progreso y repetir la revisión.

VERIFICACIÓN REALIZADA
- Sintaxis PHP compatible con 7.4 y ejecución de las pruebas con PHP 8.5 mediante WordPress PHP.wasm.
- Simulación de las operaciones de WordPress/WooCommerce: revisión sin escrituras, carga completa, interrupción/reanudación, segunda ejecución sin duplicados, exclusiones, estado borrador, conservación de precios/stock/talles y respaldo.
- Detector de color y vista extraído del tema Uniforma compartido en septiembre: reconoce las imágenes de esta carga.
- Validación de hashes, decodificación de los 172 archivos WebP y estructura del ZIP.
No se ha ejecutado esta versión en la web de producción. La compatibilidad visual debe comprobarse con el tema actualmente activo después de importar.
