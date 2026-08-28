# Notas de implementación

Este documento resume los defectos corregidos, las decisiones del cliente y los límites de la entrega. Está orientado a revisar la solución contra las reglas de negocio del challenge.

## Bugs encontrados (backend)

1. **IVA por línea, alícuota y redondeo.** El servicio calculaba el 21 % sobre el subtotal completo. Esto ignoraba la alícuota de cada artículo y el redondeo requerido. Ahora aplica el descuento antes del impuesto, calcula el IVA con la alícuota de cada línea, redondea cada resultado a dos decimales con `MidpointRounding.AwayFromZero` y luego suma los importes.
2. **Presupuestos nuevos ocultos.** La creación guardaba cada presupuesto como `Borrador`, pero el listado excluía ese estado. Como la API no expone una transición de aprobación y la facturación exige un presupuesto aprobado, un alta válida quedaba sin un flujo posterior utilizable. La creación ahora guarda el estado `Aprobado`. Esta elección mantiene coherentes el alta, el listado y la facturación sin agregar una transición fuera del alcance solicitado.
3. **Datos inválidos y referencias inexistentes.** El alta aceptaba listas vacías, validez no positiva, cantidades cero o negativas, descuentos fuera de 0 a 100 y clientes inexistentes. Los artículos inexistentes se detectaban durante el procesamiento, y `items: null` podía fallar antes del manejo de errores del controlador. La validación ahora rechaza todos esos casos antes de persistir, verifica las referencias de cliente y artículos, y obtiene precio y alícuota desde el catálogo para no confiar en valores del cliente.
4. **Numeración reutilizable y susceptible a colisiones.** El número de presupuesto se calculaba con `Count + 1`; al borrar el último registro podía reutilizarse. La factura usaba `Max + 1`, que tampoco protegía frente a solicitudes concurrentes. Se incorporaron contadores persistidos por tipo de documento y un `UPSERT ... RETURNING` de SQLite para incrementarlos de forma atómica. También se agregaron restricciones únicas para los números de presupuesto y factura. La inicialización parte del máximo existente para conservar bases creadas antes del cambio.
5. **Stock negativo.** La facturación restaba cada línea sin comprobar disponibilidad. Además, varias líneas del mismo artículo podían superar el stock en conjunto. Ahora agrupa cantidades por artículo, comprueba que todos existan y tengan stock suficiente, y recién después descuenta. La factura, el cambio de estado y el stock se guardan en una misma operación de persistencia.
6. **Facturación repetida e idempotencia.** El servicio permitía volver a facturar un presupuesto y descontar el stock otra vez. Ahora rechaza presupuestos ya facturados, exige estado `Aprobado`, verifica que no exista una factura previa y mantiene una restricción única sobre `Factura.PresupuestoId`. Si dos solicitudes compiten, el conflicto de esa restricción se convierte en un error de negocio. Una segunda solicitud no genera otra factura ni vuelve a modificar stock.

## Decisiones del cliente React

- **Base técnica:** Vite 6.4.3, React 19 y TypeScript 5.7.3. Vite se mantuvo en una versión compatible con Node.js 18. El proyecto declara Node.js `>=18.12.0` y fija pnpm 10.34.5 mediante `packageManager` para reproducir instalaciones con el archivo de bloqueo.
- **Dependencias:** no se incorporaron bibliotecas de estado global ni bibliotecas de componentes visuales. El alcance permite resolver el estado con React y mantener bajo el costo de revisión.
- **Separación:** `src/api` concentra transporte HTTP y errores; `src/domain` contiene tipos y cálculo monetario; `src/components` y `App.tsx` resuelven vistas e interacción. La URL de la API se configura con `VITE_API_URL` y usa `http://localhost:5080` como valor local predeterminado.
- **Totales en vivo:** el cálculo evita aritmética binaria de punto flotante en las operaciones monetarias. Convierte precios a centavos, representa subtotales descontados en micro unidades con `BigInt`, calcula y redondea el IVA a centavos por línea, y suma después. El backend sigue siendo la fuente de verdad al guardar.
- **Límite de descuentos:** el formulario conserva el descuento como texto y acepta únicamente valores entre 0 y 100, con hasta dos decimales. La misma función valida el total en vivo y el cuerpo enviado. Entradas con más decimales o notación científica se rechazan, sin truncarlas ni producir una excepción.
- **Idioma y formato:** toda la interfaz, los mensajes de error y los textos de accesibilidad están en español. Fechas y montos usan formateadores `es-AR`, y los importes se muestran en USD.
- **Accesibilidad y respuesta visual:** se usaron etiquetas asociadas, `fieldset` y `legend`, regiones identificadas, estados de carga, `aria-invalid`, `aria-describedby`, `aria-current`, razones visibles para acciones deshabilitadas y foco de alto contraste. La grilla cambia a tarjetas y el editor pasa a una columna en anchos reducidos. También se respeta `prefers-reduced-motion`.

## Qué hice y qué dejé afuera

Se completaron los requisitos obligatorios: correcciones de backend, listado de presupuestos, alta con selección de cliente, búsqueda y edición de artículos, totales en vivo y facturación con errores visibles. La prioridad fue proteger las reglas que afectan importes, identidad documental y stock antes de ampliar funciones.

No se implementaron los dos puntos opcionales de producto: duplicación de presupuestos y reporte de artículos facturados. Se priorizaron las validaciones, las pruebas monetarias del cliente y el manejo de estados de carga, error y vacío.

La verificación utilizada fue:

```bash
cd backend
dotnet test
```

En macOS con `dotnet@8` instalado como fórmula keg-only, el comando explícito equivalente es:

```bash
cd backend
DOTNET_ROOT="$(brew --prefix dotnet@8)/libexec" \
  "$(brew --prefix dotnet@8)/libexec/dotnet" test
```

El resultado actual del backend es 6 pruebas aprobadas, 0 fallidas y 0 omitidas sobre .NET 8.

```bash
cd frontend
corepack enable
corepack prepare pnpm@10.34.5 --activate
pnpm install --frozen-lockfile
pnpm test
pnpm lint
pnpm build
```

El resultado actual del cliente es 6 pruebas aprobadas, lint sin advertencias ni errores y compilación de producción correcta.

## Cómo usé IA

Usé IA para mapear el backend y sus flujos, proponer correcciones en lotes acotados, generar la base del cliente React y apoyar la verificación de código, pruebas y casos funcionales. La aceptación no fue automática: cada cambio quedó sujeto a revisión humana y a resultados ejecutables antes de conservarse.

La IA cometió errores concretos durante el trabajo:

- Generó inicialmente la interfaz en inglés, aunque el challenge, el dominio y el backend estaban en español. La revisión lo detectó y la interfaz completa se corrigió a español profesional.
- Eligió inicialmente npm sin confirmar la preferencia de gestor de paquetes. La decisión fue cuestionada y se migró a pnpm 10.34.5, con versión fijada y archivo de bloqueo.
- Seleccionó inicialmente Vite 8, incompatible con el requisito declarado de Node.js 18. Una validación independiente detectó el desajuste y se fijó Vite 6.4.3 junto con versiones compatibles del resto de las herramientas.
- El primer analizador monetario del cliente truncaba descuentos con más de dos decimales y podía fallar al convertir notación científica a `BigInt`. Una validación independiente reprodujo ambos casos. Se reemplazó por una frontera textual estricta de dos decimales compartida entre cálculo y envío.

La persona responsable de la entrega cuestionó explícitamente las decisiones iniciales de idioma y gestor de paquetes. La solución final usa español y pnpm. Un análisis de código de Snyk sobre el repositorio completo agotó su tiempo de espera; no se repitió a ciegas. Luego se ejecutaron análisis separados de severidad alta para backend y frontend, y ambos informaron 0 problemas.

## Qué haría con más tiempo / qué falta para producción

Los siguientes pasos se concentran en riesgos observables de esta implementación:

1. **Cerrar la carrera concurrente de stock.** La validación previa evita negativos en una solicitud, pero dos procesos pueden leer el mismo stock antes de guardar. Conviene aplicar una actualización condicional dentro de una transacción adecuada y verificar las filas afectadas.
2. **Proteger el historial de facturación.** La API todavía permite eliminar un presupuesto facturado. Se debe impedir esa eliminación o definir una política de anulación que conserve la factura y su trazabilidad.
3. **Incorporar migraciones.** `EnsureCreated` y el SQL de arranque mantienen la base del challenge, pero no son un mecanismo de evolución productiva. Se deben reemplazar por migraciones versionadas, reversibles y probadas sobre datos existentes.
4. **Agregar restricciones `CHECK` en la base.** Cantidad positiva, descuento entre 0 y 100, validez positiva y stock no negativo también deben protegerse en SQLite. La validación de servicio por sí sola no cubre escrituras externas ni futuros caminos de código.
5. **Automatizar pruebas de navegador y accesibilidad.** Faltan recorridos de extremo a extremo para crear, listar y facturar, además de validaciones automáticas de teclado, foco y accesibilidad.
6. **Ampliar las pruebas del cliente.** Las pruebas actuales cubren cálculo y análisis de descuentos. Faltan estados de red, validación del formulario, búsqueda cancelada, reintentos y errores de facturación.
7. **Completar las funciones opcionales.** Implementaría duplicación con precios vigentes antes que el reporte, porque reutiliza el flujo principal y requiere preservar con claridad qué datos se copian y cuáles se actualizan.
