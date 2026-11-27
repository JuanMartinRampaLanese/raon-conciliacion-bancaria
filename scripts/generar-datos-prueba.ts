import { mkdir, writeFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';

interface Banco {
  fecha: string;
  descripcion: string;
  centavos: number;
  moneda?: string;
  referencia?: string;
}

interface Planilla {
  fecha: string;
  descripcion: string;
  centavos: number;
  cliente?: string;
  tipo?: string;
  referencia?: string;
  moneda?: string;
}

const banco: Banco[] = [];
const planilla: Planilla[] = [];
const esperadoBanco: Record<string, { estado: string; planilla: string[] }> = {};
const esperadoPlanilla: Record<string, { estado: string; banco: string[] }> = {};

function fecha(dia: number): string {
  return String(dia).padStart(2, '0') + '/10/2026';
}

function agregarExacto(indice: number): void {
  const id = String(indice).padStart(2, '0');
  const dia = 1 + Math.floor((indice - 1) / 2);
  const centavos = 1_000_000 + indice * 1_000;
  banco.push({
    fecha: fecha(dia),
    descripcion: 'TRANSFERENCIA CLIENTE ' + id,
    centavos,
    referencia: 'ALQ-' + id,
  });
  planilla.push({
    fecha: fecha(dia),
    descripcion: 'ALQUILER CLIENTE ' + id,
    centavos,
    cliente: 'Cliente ' + id,
    tipo: 'tercero',
    referencia: 'ALQ-' + id,
  });
  esperadoBanco['B-' + String(indice).padStart(4, '0')] = {
    estado: 'conciliado',
    planilla: ['P-' + String(indice).padStart(4, '0')],
  };
  esperadoPlanilla['P-' + String(indice).padStart(4, '0')] = {
    estado: 'conciliado',
    banco: ['B-' + String(indice).padStart(4, '0')],
  };
}

for (let indice = 1; indice <= 50; indice += 1) agregarExacto(indice);

const especialesBanco: Banco[] = [
  { fecha: fecha(26), descripcion: 'TRANSFERENCIA ALFA', centavos: 600_000 },
  { fecha: fecha(27), descripcion: 'TRANSFERENCIA BETA', centavos: 600_000 },
  { fecha: fecha(27), descripcion: 'TRANSFERENCIA SIN DATOS A', centavos: 700_000 },
  { fecha: fecha(27), descripcion: 'TRANSFERENCIA SIN DATOS B', centavos: 700_000 },
  { fecha: fecha(20), descripcion: 'COBRO COMETA', centavos: 2_485_000 },
  { fecha: fecha(21), descripcion: 'DEPOSITO FOXTROT', centavos: 3_300_000 },
  { fecha: fecha(22), descripcion: 'TRANSFERENCIA GOLF PARTE 1', centavos: 900_000 },
  { fecha: fecha(23), descripcion: 'TRANSFERENCIA GOLF PARTE 2', centavos: 1_100_000 },
  { fecha: fecha(24), descripcion: 'PAGO PARCIAL HOTEL', centavos: 1_000_000 },
  { fecha: fecha(25), descripcion: 'TRANSFERENCIA PERES JAUN', centavos: 1_985_000 },
  { fecha: fecha(26), descripcion: 'MANTENIMIENTO DE CUENTA', centavos: -100_000 },
  { fecha: fecha(26), descripcion: 'IVA COMISION', centavos: -22_000 },
  { fecha: fecha(27), descripcion: 'INGRESO SIN REGISTRO', centavos: 1_234_500 },
  { fecha: fecha(28), descripcion: 'PAGO PROPIETARIO INDIA', centavos: -1_800_000 },
  { fecha: fecha(10), descripcion: 'TRANSFERENCIA JULIET', centavos: 2_200_000 },
  { fecha: fecha(12), descripcion: 'TRANSFERENCIA KILO', centavos: 2_300_000 },
  { fecha: fecha(29), descripcion: 'DEPOSITO REF 4471', centavos: 1_700_000, referencia: '4471' },
  { fecha: fecha(30), descripcion: 'TRANSFERENCIA EN DOLARES', centavos: 500_000, moneda: 'USD' },
];
banco.push(...especialesBanco);

planilla.push(
  {
    fecha: fecha(26),
    descripcion: 'ALQUILER ALFA',
    centavos: 600_000,
    cliente: 'Alfa',
    tipo: 'tercero',
  },
  {
    fecha: fecha(27),
    descripcion: 'ALQUILER BETA',
    centavos: 600_000,
    cliente: 'Beta',
    tipo: 'tercero',
  },
  {
    fecha: fecha(27),
    descripcion: 'ALQUILER GAMMA',
    centavos: 700_000,
    cliente: 'Gamma',
    tipo: 'tercero',
  },
  {
    fecha: fecha(27),
    descripcion: 'ALQUILER DELTA',
    centavos: 700_000,
    cliente: 'Delta',
    tipo: 'tercero',
  },
  {
    fecha: fecha(20),
    descripcion: 'ALQUILER COMETA',
    centavos: 2_500_000,
    cliente: 'Cometa',
    tipo: 'tercero',
  },
  {
    fecha: fecha(20),
    descripcion: 'FACTURA FOXTROT 1',
    centavos: 1_100_000,
    cliente: 'Foxtrot',
    tipo: 'tercero',
  },
  {
    fecha: fecha(21),
    descripcion: 'FACTURA FOXTROT 2',
    centavos: 1_100_000,
    cliente: 'Foxtrot',
    tipo: 'tercero',
  },
  {
    fecha: fecha(22),
    descripcion: 'FACTURA FOXTROT 3',
    centavos: 1_100_000,
    cliente: 'Foxtrot',
    tipo: 'tercero',
  },
  {
    fecha: fecha(22),
    descripcion: 'ALQUILER GOLF',
    centavos: 2_000_000,
    cliente: 'Golf',
    tipo: 'tercero',
  },
  {
    fecha: fecha(24),
    descripcion: 'ALQUILER HOTEL',
    centavos: 2_000_000,
    cliente: 'Hotel',
    tipo: 'tercero',
  },
  {
    fecha: fecha(25),
    descripcion: 'ALQUILER PERES JAUN',
    centavos: 2_000_000,
    cliente: 'Peres Jaun',
    tipo: 'tercero',
  },
  {
    fecha: fecha(28),
    descripcion: 'GIRO PROPIETARIO INDIA',
    centavos: -1_800_000,
    cliente: 'India',
    tipo: 'tercero',
  },
  {
    fecha: fecha(7),
    descripcion: 'ALQUILER JULIET',
    centavos: 2_200_000,
    cliente: 'Juliet',
    tipo: 'tercero',
  },
  {
    fecha: fecha(8),
    descripcion: 'ALQUILER KILO',
    centavos: 2_300_000,
    cliente: 'Kilo',
    tipo: 'tercero',
  },
  {
    fecha: fecha(29),
    descripcion: 'ALQUILER GOMEZ',
    centavos: 1_700_000,
    cliente: 'Gómez',
    tipo: 'tercero',
    referencia: '4471',
  },
  {
    fecha: fecha(20),
    descripcion: 'COBRO SOLO PLANILLA',
    centavos: 2_100_000,
    cliente: 'Lima',
    tipo: 'tercero',
  },
  {
    fecha: '02/11/2026',
    descripcion: 'COBRO POSTERIOR',
    centavos: 2_200_000,
    cliente: 'Mike',
    tipo: 'tercero',
  },
  {
    fecha: fecha(30),
    descripcion: 'COBRO EN DOLARES',
    centavos: 500_000,
    cliente: 'November',
    tipo: 'tercero',
    moneda: 'USD',
  },
);

function b(id: number): string {
  return 'B-' + String(id).padStart(4, '0');
}
function p(id: number): string {
  return 'P-' + String(id).padStart(4, '0');
}
function cruce(bancoIds: number[], planillaIds: number[], estado = 'conciliado'): void {
  for (const id of bancoIds) esperadoBanco[b(id)] = { estado, planilla: planillaIds.map(p) };
  for (const id of planillaIds) esperadoPlanilla[p(id)] = { estado, banco: bancoIds.map(b) };
}
cruce([51], [51]);
cruce([52], [52]);
esperadoBanco[b(53)] = { estado: 'dudoso', planilla: [] };
esperadoBanco[b(54)] = { estado: 'dudoso', planilla: [] };
esperadoPlanilla[p(53)] = { estado: 'solo_planilla', banco: [] };
esperadoPlanilla[p(54)] = { estado: 'solo_planilla', banco: [] };
cruce([55], [55], 'conciliado_con_diferencia');
cruce([56], [56, 57, 58]);
cruce([57, 58], [59]);
esperadoBanco[b(59)] = { estado: 'dudoso', planilla: [] };
esperadoPlanilla[p(60)] = { estado: 'solo_planilla', banco: [] };
cruce([60], [61], 'conciliado_con_diferencia');
esperadoBanco[b(61)] = { estado: 'gasto_bancario', planilla: [] };
esperadoBanco[b(62)] = { estado: 'gasto_bancario', planilla: [] };
esperadoBanco[b(63)] = { estado: 'solo_banco', planilla: [] };
cruce([64], [62]);
cruce([65], [63]);
esperadoBanco[b(66)] = { estado: 'dudoso', planilla: [] };
esperadoPlanilla[p(64)] = { estado: 'solo_planilla', banco: [] };
cruce([67], [65]);
esperadoPlanilla[p(66)] = { estado: 'solo_planilla', banco: [] };
esperadoPlanilla[p(67)] = { estado: 'solo_planilla', banco: [] };

function monto(valor: number): string {
  const signo = valor < 0 ? '-' : '';
  const absoluto = Math.abs(valor);
  const enteros = Math.floor(absoluto / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return signo + enteros + ',' + String(absoluto % 100).padStart(2, '0');
}

function csvBanco(filas: Banco[]): string {
  let saldo = 5_000_000;
  const lineas = [
    'Extracto ficticio RAON',
    'Cuenta: 000-000000 (datos inventados)',
    'Fecha;Descripción;Débito;Crédito;Saldo;Moneda;Referencia',
  ];
  for (const fila of filas) {
    saldo += fila.centavos;
    lineas.push(
      [
        fila.fecha,
        fila.descripcion,
        fila.centavos < 0 ? monto(Math.abs(fila.centavos)) : '',
        fila.centavos >= 0 ? monto(fila.centavos) : '',
        monto(saldo),
        fila.moneda ?? 'UYU',
        fila.referencia ?? '',
      ].join(';'),
    );
  }
  lineas.push('TOTAL;;;;;;');
  return lineas.join('\n') + '\n';
}

function csvPlanilla(): string {
  const lineas = ['Fecha;Descripción;Monto;Cliente;Tipo;Referencia;Moneda'];
  for (const fila of planilla) {
    lineas.push(
      [
        fila.fecha,
        fila.descripcion,
        monto(fila.centavos),
        fila.cliente ?? '',
        fila.tipo ?? '',
        fila.referencia ?? '',
        fila.moneda ?? 'UYU',
      ].join(';'),
    );
  }
  return lineas.join('\n') + '\n';
}

async function generar(): Promise<void> {
  await mkdir('test-data', { recursive: true });
  await mkdir('public/demo', { recursive: true });
  const csv = csvBanco(banco);
  const csvPlan = csvPlanilla();
  await writeFile('test-data/banco.csv', csv, 'utf8');
  await writeFile('test-data/planilla.csv', csvPlan, 'utf8');
  await writeFile('public/demo/banco.csv', csv, 'utf8');
  await writeFile('public/demo/planilla.csv', csvPlan, 'utf8');

  const lineasBanco = csv.trimEnd().split('\n');
  lineasBanco.splice(3 + 30, 1);
  await writeFile('test-data/banco_saldo_roto.csv', lineasBanco.join('\n') + '\n', 'utf8');
  await writeFile(
    'test-data/esperado.json',
    JSON.stringify({ banco: esperadoBanco, planilla: esperadoPlanilla }, null, 2) + '\n',
    'utf8',
  );

  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Extracto');
  hoja.addRow(['Extracto ficticio RAON']);
  hoja.addRow(['Cuenta 000-000000']);
  hoja.addRow(['Fecha', 'Descripción', 'Importe', 'Moneda', 'Referencia']);
  for (const fila of [...banco].reverse()) {
    const [dia, mes, anio] = fila.fecha.split('/').map(Number);
    hoja.addRow([
      new Date(Date.UTC(anio, mes - 1, dia)),
      fila.descripcion,
      fila.centavos / 100,
      fila.moneda ?? 'UYU',
      fila.referencia ?? '',
    ]);
  }
  await libro.xlsx.writeFile('test-data/banco_formato_b.xlsx');
}

generar().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
