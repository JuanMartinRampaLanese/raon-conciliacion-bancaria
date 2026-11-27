# SPEC — Conciliación bancaria para fondos de terceros

> Producto de **RAON** (agencia de automatización e IA para pymes, Montevideo).
> Este archivo es la fuente de verdad. Codex implementa una fase por tarea y marca los ítems al terminar.

---

## 1. Qué es

Una web donde el negocio sube **el extracto del banco** y **su planilla de movimientos**, y en minutos recibe:
- qué movimientos cerraron,
- qué está solo en el banco y qué está solo en la planilla,
- qué casos son dudosos y necesitan una persona,
- **cuánta plata del banco es de cada cliente o propietario** (fondos de terceros),
- si el saldo del extracto cierra.

Todo en pantalla y en un Excel descargable. **Los archivos nunca salen de la computadora del usuario:** se procesan en el navegador.

## 2. Para quién

Negocios que manejan plata de terceros: inmobiliarias que administran alquileres, administradoras de gastos comunes, estudios jurídicos con fondos de clientes y escribanías. También estudios contables que llevan la contabilidad de esos negocios.

## 3. Stack

- Next.js (versión estable actual, App Router) + TypeScript `strict`
- Tailwind CSS + shadcn/ui
- ExcelJS (leer y escribir `.xlsx`) + Papa Parse (`.csv`)
- Zod (validación)
- Vitest (tests)
- Supabase (Auth + Postgres) — **solo desde la Fase 3** y opcional: sin variables de Supabase la app funciona en modo local
- Deploy: Vercel

## 4. Estructura de carpetas

```
app/                      páginas y route handlers
  page.tsx                landing
  conciliar/              asistente de 3 pasos
  resultado/              resultados, revisión de dudosos y descarga
  reglas/                 reglas y plantillas de banco
  api/ia/route.ts         (Fase 4) proxy de IA, solo para dudosos
components/
lib/
  lectura/                archivos → filas crudas, detección de encabezados
  normalizar/             fechas, montos, textos
  motor/                  cruce en cascada (funciones puras)
  cierre/                 control de saldo
  saldos/                 saldos por cliente (fondos de terceros)
  excel/                  generación del Excel de salida
  almacen/                interfaz Almacen + implementación local y Supabase
  worker/                 Web Worker que corre lectura + motor + excel
scripts/conciliar.ts      CLI
supabase/migrations/      (Fase 3)
test-data/                datos inventados + resultados esperados
public/demo/              archivos de ejemplo para el modo demo
```

## 5. Modelo de datos (TypeScript)

```ts
type Origen = 'banco' | 'planilla';
type Moneda = 'UYU' | 'USD' | 'ARS' | 'EUR';

interface Movimiento {
  id: string;            // 'B-0001' | 'P-0001', estable según el orden del archivo
  origen: Origen;
  fecha: string;         // 'AAAA-MM-DD'
  descripcion: string;   // texto original
  texto: string;         // normalizado: MAYÚSCULAS, sin tildes, sin signos, espacios simples
  centavos: number;      // entero con signo: + entra plata, − sale plata
  moneda: Moneda;
  cliente?: string;      // planilla; en banco solo si lo asignó una regla
  referencia?: string;
  tipo?: 'tercero' | 'propio'; // planilla: si no viene, 'tercero' cuando hay cliente y 'propio' cuando no
  saldoCentavos?: number;      // banco, si el extracto trae saldo
  fila: number;          // fila original del archivo, para que el usuario la encuentre
}

type Estado =
  | 'conciliado'
  | 'conciliado_con_diferencia'
  | 'gasto_bancario'
  | 'dudoso'
  | 'solo_banco'
  | 'solo_planilla';

type Paso = 'exacto' | 'tolerancia' | 'uno_a_muchos' | 'muchos_a_uno' | 'regla' | 'manual';

interface Candidato { planilla: string[]; puntaje: number; motivo: string; }

interface Resultado {
  id: string;
  estado: Estado;
  paso?: Paso;
  banco: string[];            // ids de movimientos del banco
  planilla: string[];         // ids de movimientos de la planilla
  diferenciaCentavos: number; // banco − planilla
  puntaje: number;            // 0..1
  nota: string;               // explicación en español para el usuario
  candidatos?: Candidato[];   // solo dudosos (máx. 3)
  sugerenciaIA?: { indice: number | null; confianza: number; motivo: string };
}

interface Regla {
  id: string;
  patron: string;             // texto normalizado; se aplica como "contiene"
  accion: 'asignar_cliente' | 'gasto_bancario';
  cliente?: string;
  origen: 'por_defecto' | 'manual' | 'revision';
}

interface ConfigMotor {
  ventanaDias: number;          // 3
  ventanaAgrupadoDias: number;  // 7
  toleranciaPct: number;        // 0.01
  toleranciaMaxCentavos: number;// 50000 (500 unidades): con 50 no entraban los casos obligatorios de $ 150 de comisión
  similitudMin: number;         // 0.6
  maxAgrupados: number;         // 3
  puntajeMinDudoso: number;     // 0.4
}
```

## 6. Entradas

### 6.1 Archivos
- Extracto bancario: `.xlsx` o `.csv`.
- Planilla del negocio: `.xlsx` o `.csv` con fecha, descripción, monto (o debe/haber), cliente, y opcionales referencia, tipo y moneda.
- `.xls` (Excel viejo): mostrar "Guardalo como .xlsx o .csv y volvé a subirlo".
- `lib/lectura` recibe **bytes (`Uint8Array`), sin `Buffer` ni `fs`**: el mismo código corre en la CLI y en el Web Worker (Fase 2). `fs` queda solo en un archivo aparte para la CLI.
- CSV: si los bytes no son UTF-8 válido, leerlos como **Windows-1252** (Excel en Windows en español y varios bancos exportan así; si no, se rompen las tildes y encabezados como "Descripción" o "Débito"). Separador `,` o `;` detectado automáticamente.
- Límites: 10 MB y 20.000 filas por archivo. Si se pasa, mensaje claro.

### 6.2 Detección de encabezados
- Buscar la fila de encabezados en las primeras 15 filas (los bancos suelen poner títulos arriba).
- Sinónimos (comparar texto normalizado):
  - fecha: `FECHA, FEC, F. VALOR, FECHA VALOR, FECHA OPERACION, DATE`
  - descripción: `DESCRIPCION, CONCEPTO, DETALLE, MOVIMIENTO, REFERENCIA DEL MOVIMIENTO`
  - débito: `DEBITO, DEBE, EGRESO, RETIRO`
  - crédito: `CREDITO, HABER, INGRESO, DEPOSITO`
  - importe: `IMPORTE, MONTO, VALOR`
  - saldo: `SALDO`
  - cliente: `CLIENTE, PROPIETARIO, INQUILINO, TITULAR, CASO`
  - referencia: `REFERENCIA, REF, NRO, COMPROBANTE`
  - moneda: `MONEDA, DIVISA`
- Ignorar filas sin fecha válida al final (totales) y filas vacías.
- Si no se detecta una columna obligatoria, el usuario la elige en el paso de mapeo. El mapeo se guarda como **plantilla de banco** (por nombre de banco) y se reutiliza.

### 6.3 Normalización
- **Fechas:** `dd/mm/aaaa`, `dd-mm-aa`, `dd.mm.aaaa`, `aaaa-mm-dd`, número de serie de Excel y objetos `Date` de ExcelJS. Por defecto día/mes (Uruguay). Detectar por archivo: si algún valor tiene el segundo número > 12, el archivo es mes/día.
- **Montos** (parsear como texto, nunca con `parseFloat` directo): `1.234,56`, `1,234.56`, `1234.56`, `-1.234,56`, `(1.234,56)`, `1.234,56-`, `$ 1.234`, `U$S 50,00`. Si hay un solo tipo de separador seguido de exactamente 3 dígitos, es separador de miles. Resultado en centavos enteros.
- Débito y crédito separados → un solo monto con signo (crédito +, débito −).
- **Texto:** mayúsculas, sin tildes, sin signos de puntuación, espacios simples.
- **Orden:** si el extracto viene de más nuevo a más viejo, invertirlo.
- **Moneda:** una conciliación por moneda. Si el archivo trae columna de moneda con varias, filtrar la elegida y avisar cuántas filas quedaron afuera.

## 7. Motor de cruce (`lib/motor/`)

Función principal pura:

```ts
conciliar(entrada: {
  banco: Movimiento[];
  planilla: Movimiento[];
  reglas: Regla[];
  config?: Partial<ConfigMotor>;
}): { resultados: Resultado[]; resumen: Resumen }
```

Reglas generales:
- Cada movimiento se usa **una sola vez**.
- Siempre se cruzan movimientos **del mismo signo** (cobros con cobros, pagos con pagos).
- Orden de procesamiento determinístico: movimientos del banco por fecha, después por |monto| descendente, después por id. **Misma entrada → mismo resultado.** Ordenar comparando por código de carácter, **no con `localeCompare`** (depende del idioma del sistema; el motor corre en Node y en el navegador).
- Rendimiento: 2.000 × 2.000 movimientos en menos de 2 s. Indexar la planilla por monto y por cliente; nada de comparar todos contra todos en los pasos de combinaciones.

### 7.1 Similitud
- Quitar palabras vacías antes de comparar: `TRF, TRANSF, TRANSFERENCIA, RECIBIDA, ENVIADA, DEP, DEPOSITO, PAGO, COBRO, DE, DEL, LA, EL, LOS, LAS, Y, SA, SRL, SAS, LTDA`.
- Similitud = coeficiente de Dice sobre trigramas entre el texto del banco y (cliente + texto) de la planilla.
- Si todas las palabras del nombre del cliente (de 3 letras o más) aparecen en el texto del banco, en cualquier orden, la similitud es al menos 0,9 ("PEREZ JUAN" = "JUAN PEREZ").
- Si una regla asignó el mismo cliente al movimiento del banco, la similitud es 1.

### 7.2 Puntaje (para elegir y para dudosos)
```
montoScore = 1 si es exacto; si no, max(0, 1 − |diferencia| / (0,05 · |monto planilla|))
fechaScore = max(0, 1 − |días de diferencia| / 10)
puntaje    = 0,5 · montoScore + 0,3 · similitud + 0,2 · fechaScore
```

### 7.3 Cascada
0. **Reglas `asignar_cliente`:** si el texto del banco contiene el patrón, se asigna ese cliente al movimiento (no concilia, solo agrega información).
1. **Exacto:** mismo monto, mismo signo y fecha a ±`ventanaDias`. Se concilia solo si el emparejamiento es **único en las dos direcciones** (el movimiento del banco tiene un solo candidato y ese candidato no es candidato de otro movimiento del banco). Si hay empate, desempatar por cliente asignado o por similitud ≥ `similitudMin` cuando uno solo la supera. Si los candidatos son indistinguibles (mismo monto, cliente y fecha), emparejar por orden de fecha y fila. Si no se puede desempatar, queda para dudosos.
2. **Tolerancia:** |diferencia| ≤ min(`toleranciaPct` · |monto planilla|, `toleranciaMaxCentavos`), mismo signo, fecha a ±`ventanaDias` y (similitud ≥ `similitudMin` o mismo cliente por regla). Único en las dos direcciones → `conciliado_con_diferencia`, nota: "Diferencia de $ X (posible comisión o retención)".
3. **Uno a muchos:** un movimiento del banco = suma de 2 a `maxAgrupados` movimientos de la planilla **del mismo cliente**, con fechas a ±`ventanaAgrupadoDias`. El cliente del banco sale de una regla o de similitud ≥ `similitudMin`. Máximo 12 candidatos por búsqueda. Suma exacta → `conciliado`; dentro de tolerancia → `conciliado_con_diferencia`. Si más de una combinación sirve → dudoso.
4. **Muchos a uno:** 2 a `maxAgrupados` movimientos del banco del mismo cliente = un movimiento de la planilla (pago en partes). Mismas condiciones que el paso 3.
5. **Reglas `gasto_bancario`:** se aplican **después** de los cruces y solo a movimientos del banco **negativos** que quedaron sin cruzar → estado `gasto_bancario`. Reglas por defecto (editables): `COMISION`, `IVA COMISION`, `GASTOS BANCARIOS`, `MANTENIMIENTO DE CUENTA`, `IMPUESTO`.
6. **Dudosos:** movimientos del banco sin cruzar con al menos un candidato de puntaje ≥ `puntajeMinDudoso` → `dudoso` con los 3 mejores candidatos y el motivo de cada uno. Caso especial: mismo cliente y el banco es menor que la planilla → motivo "Posible pago parcial: faltan $ X".
7. **Resto:** `solo_banco` y `solo_planilla`, cada uno con una sugerencia:
   - Solo en planilla con fecha posterior al último día del extracto → "Posterior al cierre del extracto: probablemente aparece el mes que viene".
   - Solo en planilla, positivo → "Cobro registrado que no aparece en el banco: verificar si se depositó".
   - Solo en banco, positivo → "Ingreso sin registrar en la planilla: ¿falta cargarlo?".
   - Solo en banco, negativo y chico (< 1.000 unidades) → "¿Gasto bancario? Podés crear una regla".

### 7.4 Revisión manual
- Aceptar un dudoso crea un `Resultado` con `paso: 'manual'`.
- Al aceptar, ofrecer crear una regla `asignar_cliente` con un patrón sugerido (las palabras del texto del banco que no son palabras vacías ni números de más de 6 dígitos), editable por el usuario.
- Recalcular el resumen sin volver a subir los archivos.

## 8. Control de cierre (`lib/cierre/`)
- Si el extracto trae saldo: saldo inicial = saldo de la primera fila − su movimiento; saldo final = saldo de la última fila. Verificar `saldo inicial + suma de movimientos = saldo final`.
- Verificar además el saldo fila por fila y listar las filas donde se corta (señal de filas faltantes o mal leídas).
- Si no trae saldo, el usuario puede escribir saldo inicial y final; si no los escribe, mostrar "Cierre no verificado" en amarillo.
- Si no cierra: alerta roja en pantalla y en el Excel, con la diferencia.

## 9. Fondos de terceros (`lib/saldos/`)
- Por cliente, solo con filas `tipo = 'tercero'`: cobrado (positivos), pagado (negativos), saldo (cobrado − pagado), cuánto de eso está conciliado y cuánto pendiente.
- Total de saldos de terceros vs saldo final del banco:
  - "Fondos de terceros: $ X — Saldo en banco: $ Y — Diferencia: $ Z".
  - Si Z < 0, alerta roja: "En el banco hay menos plata que la que se le debe a terceros".

## 10. Excel de salida (`lib/excel/`)
Nombre: `conciliacion_{banco}_{moneda}_{AAAA-MM}.xlsx`. Hojas:
1. **Resumen:** banco, moneda, período, cantidad de movimientos de cada lado, % conciliado (por cantidad y por monto), totales por estado, control de cierre, fondos de terceros vs saldo, fecha de generación y el aviso "Revisar antes de usar estos resultados para hacer pagos".
2. **Conciliados** (incluye con diferencia y agrupados): estado, paso, fecha/descripción/monto del banco, fecha/descripción/cliente/monto de la planilla, diferencia, nota, filas originales.
3. **Dudosos:** movimiento del banco, los 3 candidatos con puntaje y motivo, sugerencia de IA si existe.
4. **Solo en banco** (con los gastos bancarios marcados aparte).
5. **Solo en planilla** con sugerencia.
6. **Saldos por cliente.**
7. **Reglas aplicadas:** cada regla y cuántos movimientos tocó.

Formato: montos con `#,##0.00`, fechas como fechas reales `dd/mm/aaaa`, encabezado fijo, autofiltro, anchos de columna, colores por estado (verde, amarillo, rojo). **Los textos se escriben siempre como texto, nunca como fórmula** (evita inyección de fórmulas con descripciones que empiezan con `=`, `+`, `-` o `@`); con test.

## 11. Pantallas
- `/` — Landing: qué hace en 3 líneas, botón **"Probar con datos de ejemplo"** y botón "Nueva conciliación". Aviso visible: "Tus archivos se procesan en tu navegador y no se suben a ningún servidor".
- `/conciliar` — Asistente de 3 pasos:
  1. Extracto + banco (elegir plantilla existente o crear) + moneda.
  2. Planilla.
  3. Mapeo de columnas: vista previa de 10 filas, selects precargados por la detección y, al lado de cada valor crudo, el valor interpretado (fecha y monto) para que el usuario vea si se leyó bien. Botón "Conciliar".
- `/resultado` — Tarjetas: % conciliado, dudosos, solo banco, solo planilla, cierre (ok/alerta), fondos de terceros vs saldo. Pestañas por estado con tabla, buscador y filtros. Revisión de dudosos: candidatos, "Aceptar" o "Rechazar", y crear regla. Botón **"Descargar Excel"**.
- `/reglas` — Ver, editar y borrar reglas y plantillas de banco.
- Todo responsive, accesible con teclado y con etiquetas. Montos en formato `es-UY` (`$ 1.234,56`, `US$ 50,00`).
- Mientras corre el Web Worker, barra de progreso; la interfaz no se congela.

## 12. Modos de funcionamiento
- **Local / demo** (sin variables de Supabase): reglas y plantillas en `localStorage` (siempre dentro de try/catch). Con `NEXT_PUBLIC_DEMO_MODE=true` se muestra un banner "Modo demo" y el botón que carga los archivos de `public/demo/`.
- **Con cuenta** (Fase 3, con variables de Supabase): login y datos guardados por organización.
- La elección la hace `lib/almacen/` con una interfaz única:
  ```ts
  interface Almacen {
    listarReglas(): Promise<Regla[]>;
    guardarRegla(r: Regla): Promise<void>;
    borrarRegla(id: string): Promise<void>;
    listarPlantillas(): Promise<PlantillaBanco[]>;
    guardarPlantilla(p: PlantillaBanco): Promise<void>;
    guardarResumen(r: Resumen): Promise<void>;
    listarResumenes(): Promise<Resumen[]>;
  }
  ```

## 13. Supabase (Fase 3)
- Auth por enlace mágico al mail. Al primer login se crea una organización y el usuario queda como dueño.
- Tablas (todas con `organizacion_id`): `organizaciones`, `miembros` (usuario, organización, rol), `cuentas` (banco, moneda, alias), `plantillas_banco` (mapeo de columnas en JSON), `reglas`, `conciliaciones` (**solo el resumen**: cuenta, período, totales, % conciliado, cierre_ok, creada_por, creada_el).
- **Nunca** se guardan movimientos ni archivos.
- RLS activado en todas las tablas: un usuario solo ve y modifica filas de organizaciones donde es miembro. Migraciones en `supabase/migrations/`.
- Si el entorno lo permite, tests de RLS en `supabase/tests/` (pgTAP); si no, documentar en el README cómo probarlo a mano.
- Pantalla `/historial` con los resúmenes de conciliaciones anteriores.

## 14. IA opcional (Fase 4)
- Solo si `AI_ENABLED=true`. Proveedor detrás de una interfaz `ProveedorIA` (primera implementación: Gemini por REST, modelo en `AI_MODEL`).
- Route handler `POST /api/ia` que recibe **solo** los dudosos (fecha, descripción, monto y cliente del movimiento y de sus candidatos; nada más). Máximo 50 por pedido, timeout de 10 s.
- Pide JSON `{ indice: number | null, confianza: number, motivo: string }`, validado con Zod. Si falla, se ignora sin romper nada.
- El resultado se guarda en `sugerenciaIA` y el estado sigue siendo `dudoso`.
- En la interfaz, aviso: "Con datos reales de clientes, usá solo un proveedor que no entrene con tus datos (plan pago)".

## 15. Seguridad
- Procesamiento en el navegador; el servidor nunca recibe los archivos.
- Sin logs del contenido de los archivos, ni en el cliente ni en el servidor.
- Validación con Zod de todo lo que llega al servidor.
- Encabezados: CSP que funcione con Next.js (nonce por middleware si hace falta; `frame-ancestors 'none'`; `connect-src` limitado a la app, Supabase y el proveedor de IA si está activo), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restrictiva.
- Sin expresiones regulares peligrosas sobre texto del usuario (evitar backtracking catastrófico).
- `SECURITY.md` con cómo reportar vulnerabilidades.
- CI con escaneo de secretos (gitleaks) y CodeQL; Dependabot semanal para npm y GitHub Actions.

## 16. Datos de prueba
En `test-data/`, todo inventado (nombres, cuentas y referencias ficticias), período octubre 2026, moneda UYU salvo que se indique:
- `banco.csv` (~70 filas) con filas de título antes del encabezado, débito y crédito separados, montos `1.234,56`, columna saldo coherente y una fila de TOTAL al final.
- `banco_formato_b.xlsx`: el mismo contenido con una sola columna de importe con signo, fechas como fechas de Excel y orden de más nuevo a más viejo.
- `banco_saldo_roto.csv`: igual a `banco.csv` pero con una fila borrada (el cierre tiene que fallar y marcar dónde se corta).
- `planilla.csv` (~70 filas) con cliente, tipo y referencia.
- Casos que tienen que estar sí o sí:
  1. ~30 cobros de alquiler con monto y fecha exactos.
  2. Dos cobros del mismo monto la misma semana de clientes distintos, resueltos por nombre.
  3. Dos cobros del mismo monto imposibles de distinguir → dudoso.
  4. Comisión descontada: planilla 25.000, banco 24.850 → conciliado con diferencia.
  5. Un depósito que paga 3 alquileres del mismo cliente → uno a muchos.
  6. Un alquiler pagado en 2 transferencias → muchos a uno.
  7. Pago parcial: banco 10.000 contra planilla 20.000 → dudoso "posible pago parcial".
  8. Nombre mal escrito ("PERES JAUN") con comisión → conciliado con diferencia por similitud.
  9. Comisión de mantenimiento e IVA de comisión → gasto bancario.
  10. Un ingreso solo en banco.
  11. Un cobro solo en planilla y otro con fecha posterior al cierre del extracto.
  12. Pagos a propietarios (negativos) que cruzan con la planilla.
  13. Diferencia de fecha de 3 días (cruza) y de 4 días (no cruza en el paso exacto).
  14. Depósito con "REF 4471" y una regla "REF 4471 → Gómez".
  15. Filas en USD que quedan afuera al conciliar en UYU.
- `esperado.json`: para cada movimiento, el estado esperado y con qué ids cruza. **Se escribe a mano según la intención de cada caso, no generándolo con el motor** (si no, el test no prueba nada).
- `public/demo/`: una copia de `banco.csv` y `planilla.csv` para el botón de demo.

## 17. Calidad
- Tests unitarios de normalización (todas las variantes de fecha y monto de la sección 6.3), de cada paso del motor, del cierre, de los saldos y del Excel (abrir el archivo generado con ExcelJS y verificar hojas, totales y que no haya fórmulas).
- Test "golden": correr el motor sobre `test-data/` y comparar con `esperado.json`.
- Test de determinismo: dos corridas dan exactamente el mismo resultado.
- Test de rendimiento: 2.000 × 2.000 movimientos generados en menos de 2 s.
- GitHub Actions (`.github/workflows/ci.yml`): `npm ci`, lint, typecheck, test y build en cada push y PR.

## 18. README (portfolio)
En español, con este orden:
1. Título + una línea: "Conciliá el extracto del banco con tu planilla en minutos y sabé cuánta plata es de cada cliente."
2. Badge de CI.
3. GIF o captura (dejar `docs/demo.gif` como marcador; lo agrega el autor).
4. **El problema** (3 viñetas) y **qué hace** (5 viñetas).
5. **Demo en vivo:** enlace (marcador para completar).
6. **Cómo funciona:** diagrama Mermaid del flujo (archivos → normalización → cascada → revisión → Excel).
7. **Decisiones técnicas:** procesamiento en el navegador, montos en centavos, motor determinístico con tests, la IA solo sugiere, reglas que aprenden de cada revisión.
8. **Seguridad y privacidad:** qué se guarda y qué no; mención de la Ley 18.331 de Uruguay como marco que el diseño tiene en cuenta (sin afirmar certificaciones).
9. **Correr localmente** en 3 comandos y **cómo probarlo** con `test-data/`.
10. Estructura del proyecto y cobertura de tests.
11. Roadmap (sección 20).
12. Autor: **RAON** — Juan Martín Rampa Lanese (JuanMa), con marcadores para web, LinkedIn y contacto.
13. Licencia: "© 2026 RAON. Todos los derechos reservados. El código se publica para mostrar el trabajo; para usarlo en tu negocio, contactanos." (sin archivo de licencia open source).

---

## 19. Fases

### Fase 1 — Motor, Excel y consola
- [x] Proyecto Next.js + TypeScript strict + Tailwind + shadcn/ui + Vitest + ESLint + Prettier
- [x] `.gitignore`, `.env.example`, `SECURITY.md`, README inicial
- [x] CI (lint, typecheck, test, build), gitleaks, CodeQL y Dependabot
- [x] `lib/lectura`: CSV y XLSX → filas crudas; detección de encabezados por sinónimos
- [x] `lib/normalizar`: fechas, montos en centavos, textos, orden y moneda
- [x] `lib/motor`: cascada completa (pasos 0 a 7) y revisión manual
- [x] `lib/cierre` y `lib/saldos`
- [x] `lib/excel`: las 7 hojas con formato
- [x] `test-data/` completo con `esperado.json` escrito a mano
- [x] Tests: normalización, cada paso, golden, determinismo, rendimiento, Excel sin fórmulas
- [x] CLI `npm run conciliar -- --banco ... --planilla ... --moneda UYU [--mapeo mapeo.json]` que imprime el resumen y genera el Excel en `salida/` (carpeta en `.gitignore`)

#### Correcciones de la revisión (2026-11-24)
- [x] Excel, hoja **Resumen**: los formatos quedaron corridos una fila (se asignan por dirección de celda). Hoy "Movimientos de la planilla" sale como `6700,00 %`, "Diferencia fondos/banco" como la fecha `03/06/1921` y "Generado el" con formato `mm-dd-yy`. Asignar el formato según el indicador, no según la celda. Los totales por estado van en columnas aparte (cantidad y monto con `#,##0.00`), no como texto ("57 movimientos — 598750"). Test que abra el Excel y verifique el formato de cada fila del Resumen.
- [x] Pago parcial (paso 6, caso 7 de `test-data`): el motivo "Posible pago parcial: faltan $ X" solo aparece si una regla le asignó cliente al movimiento del banco. Tiene que usar el mismo criterio de cliente que los pasos 3 y 4 (regla **o** similitud ≥ `similitudMin` con el cliente de la planilla). Hoy el caso 7 sale con el motivo genérico "47% de coincidencia". Agregar al test golden la verificación del motivo de ese caso.
- [x] `totalesPorEstado.solo_planilla` da 0 centavos: sumar los montos de la planilla.
- [x] Si varias reglas `gasto_bancario` coinciden, se aplica la más específica (el patrón más largo): hoy "IVA COMISION" se atribuye a la regla "COMISION". La hoja "Reglas aplicadas" cuenta solo la regla que se aplicó (hoy cuenta todas las que coinciden).
- [x] Puntajes redondeados a 2 decimales en el motor (hoy aparece `0.47000000000000003`).
- [x] `npm audit` marca 2 vulnerabilidades moderadas (`uuid` vía ExcelJS). Agregar en `package.json` `"overrides": { "exceljs": { "uuid": "^11.1.1" } }`, como en cobranza, y dejar `npm audit` en 0.
- [x] CLI: parámetro opcional `--nombre-banco "BROU"` para el Resumen y el nombre del archivo (hoy usa el nombre del archivo: "banco").

### Fase 2 — Interfaz web (sin backend)
- [ ] Landing con aviso de privacidad y botón de demo
- [ ] Asistente de 3 pasos con mapeo de columnas y vista previa interpretada
- [ ] Web Worker para lectura + motor + Excel, con barra de progreso
- [ ] `/resultado` con tarjetas, pestañas, buscador y filtros
- [ ] Revisión de dudosos con creación de reglas
- [ ] `/reglas` con reglas y plantillas en `localStorage`
- [ ] Descarga del Excel
- [ ] Modo demo (`NEXT_PUBLIC_DEMO_MODE`) con los archivos de `public/demo/`
- [ ] Instrucciones de deploy en Vercel en el README

### Fase 3 — Cuentas y datos guardados (Supabase)
- [ ] Migraciones con todas las tablas y RLS
- [ ] Login por enlace mágico y creación de organización
- [ ] `almacenSupabase` implementando `Almacen`; la app elige local o Supabase según las variables
- [ ] `/historial` con resúmenes
- [ ] Tests de RLS (pgTAP) o guía de prueba manual en el README

### Fase 4 — IA opcional, seguridad y pulido de portfolio
- [ ] `ProveedorIA` + `/api/ia` detrás de `AI_ENABLED`, con Zod, límites y timeout
- [ ] Sugerencias de IA en la revisión de dudosos y en el Excel
- [ ] Encabezados de seguridad y CSP
- [ ] README final completo (sección 18) con diagrama Mermaid
- [ ] Revisión de accesibilidad y textos

## 20. Fuera de alcance (roadmap)
- Extractos en PDF (requiere PDFs reales de cada banco).
- Conexión directa con bancos.
- Invitar a más miembros a la organización.
- Conectar con el sistema de cobranza para avisar pagos automáticamente.

## 21. Registro de avances
<!-- Codex: agregá una entrada por fase. Formato:
### Fase N — AAAA-MM-DD
- Hecho: ...
- Decisiones: ...
- Probar a mano: ...
-->

### Fase 1 — 2026-11-24
- Hecho: se inicializó Next.js 16 con TypeScript estricto, Tailwind, configuración de shadcn/ui, Vitest, ESLint y Prettier; se agregaron documentación, archivos de entorno falsos, CI, gitleaks, CodeQL y Dependabot. Se implementaron lectura CSV/XLSX desde `Uint8Array`, detección de encabezados, Windows-1252, normalización regional, motor completo y determinístico, revisión manual, cierre, fondos de terceros, Excel de siete hojas y CLI. Se incorporaron 68 filas ficticias por archivo (67 UYU procesables y una USD excluida), XLSX invertido, extracto con saldo roto, `esperado.json` definido por intención y 34 tests, incluido 2.000 × 2.000.
- Decisiones: la web queda como base técnica mínima porque las pantallas son Fase 2; `fs` aparece solo en la CLI y en el generador de fixtures. Los textos de Excel se escriben como valores, nunca como fórmulas. Ante la contradicción entre `toleranciaMaxCentavos: 5000` ($ 50) y los casos obligatorios de $ 150 de diferencia, se priorizaron los casos de prueba explícitos y se fijó el máximo predeterminado en 50.000 centavos ($ 500); conviene confirmar este criterio comercial antes de producción. El XLSX exigido se genera desde datos ficticios versionables y `esperado.json` no consulta al motor.
- Probar a mano: ejecutar la CLI con `test-data/banco.csv` y `test-data/planilla.csv`, abrir el Excel de `salida/` y revisar las siete hojas, colores, filtros, fechas y totales. Repetir con `test-data/banco_formato_b.xlsx` para validar fechas de Excel y orden inverso, y con `test-data/banco_saldo_roto.csv` para confirmar la alerta de cierre. Probar también un CSV real anonimizado exportado por el banco y, si los encabezados no coinciden, un archivo `--mapeo` propio.

### Fase 1 — Correcciones de revisión — 2026-11-24
- Hecho: se corrigieron los formatos de cada indicador de la hoja Resumen y se separaron los totales por estado en columnas numéricas de cantidad y monto. El pago parcial ahora reconoce al cliente por regla o por similitud, `solo_planilla` suma los importes de la planilla, los puntajes salen con dos decimales y las reglas de gasto eligen el patrón más largo. La hoja Reglas aplicadas cuenta únicamente la regla seleccionada. Se agregó `--nombre-banco`, el override seguro de `uuid` para ExcelJS y tests específicos; la suite quedó en 40 tests.
- Decisiones: la especificidad de las reglas se mide sobre el patrón normalizado y, ante patrones del mismo largo, se conserva el orden original. El redondeo se hace al calcular el puntaje para que resultados y candidatos compartan el mismo valor. `--nombre-banco` conserva como fallback el nombre del archivo, sin cambiar ejecuciones existentes. En el Resumen, las filas de estado dejan vacía la columna Valor con `null` para evitar heredar visualmente el formato de fecha.
- Probar a mano: ejecutar la CLI con `--nombre-banco "BROU"`, confirmar que el archivo se llama `conciliacion_brou_UYU_2026-10.xlsx` y abrir Resumen para revisar porcentajes, fecha, montos y totales por estado. En Dudosos, comprobar que el pago parcial muestra cuánto falta. En Reglas aplicadas, verificar que `IVA COMISION` cuente ese movimiento y `COMISION` no lo duplique.
