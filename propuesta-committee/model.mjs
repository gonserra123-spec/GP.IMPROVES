// Modelo económico de la propuesta. Lo usan el PowerPoint, la API y el simulador web,
// así que todas las cifras salen de aquí.
//
// IMPORTANTE: no tenemos la ocupación ni la caja reales de Committee. La ocupación de
// partida, las conversiones y los costes son SUPUESTOS ILUSTRATIVOS. Los precios de mesa
// sí vienen de fuentes públicas. Hay que sustituir los supuestos por datos reales del
// grupo antes de presentar cifras como compromiso.

import { TABLES } from './data.mjs';

export const ASSUMPTIONS = {
  weeksPerSeason: 36, // septiembre–mayo, descontando semanas sin apertura
  occupancy: { thu: 0.35, fri: 0.6, sat: 0.7 }, // % de mesas vendidas (supuesto)
  extraSpend: 0.1, // gasto por encima del mínimo (supuesto)
  grossMargin: 0.65, // margen bruto de la bebida (supuesto)
  uniqueRatio: 0.7, // grupos distintos / mesas vendidas
  guestsPerTable: 4, // invitados que no reservan pero acuden
  lapsedShare: 0.4, // titulares con más de 60 días sin volver
  campaignsPerSeason: 2,
  birthdayWindow: 0.75, // fracción del año cubierta por la temporada
  incrementality: { reactivation: 0.8, birthday: 0.5 }, // % que no habría venido igual
  incrementalMix: { tarima: 0.5, principal: 0.2, petit: 0.3, ghost: 0 }, // dónde se vende la mesa extra
  offerCostPct: 0.12, // coste de la ventaja ofrecida sobre el precio de la mesa
  msgsPerContactSeason: 4,
  waCostPerMsg: 0.06, // € por mensaje de marketing (comprobar tarifa vigente de Meta)
  fees: { setup: 2000, monthly: 450, months: 9 }, // propuesta orientativa de precio
};

export const SCENARIOS = {
  conservador: { optIn: 0.4, guestCapture: 0.3, reactConv: 0.04, birthdayConv: 0.015, recovered: 0.015, flowShare: 0.4, upsell: 0.04 },
  base: { optIn: 0.5, guestCapture: 0.5, reactConv: 0.07, birthdayConv: 0.03, recovered: 0.03, flowShare: 0.6, upsell: 0.08 },
  optimista: { optIn: 0.6, guestCapture: 0.7, reactConv: 0.1, birthdayConv: 0.05, recovered: 0.045, flowShare: 0.8, upsell: 0.12 },
};

const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function zoneStats() {
  const zones = {};
  for (const t of TABLES) {
    const z = (zones[t.zone] ??= { id: t.zone, tables: 0, weekendSum: 0, thuSum: 0 });
    z.tables++;
    z.weekendSum += t.price[0];
    z.thuSum += t.price[1];
  }
  for (const z of Object.values(zones)) {
    z.weekendAvg = z.weekendSum / z.tables;
    z.thuAvg = z.thuSum / z.tables;
  }
  return zones;
}

export function runModel(scenario = 'base', over = {}) {
  const a = { ...ASSUMPTIONS, ...(over.assumptions ?? {}) };
  a.occupancy = { ...ASSUMPTIONS.occupancy, ...(over.assumptions?.occupancy ?? {}) };
  a.fees = { ...ASSUMPTIONS.fees, ...(over.assumptions?.fees ?? {}) };
  const s = { ...SCENARIOS[scenario], ...(over.levers ?? {}) };

  const zones = zoneStats();
  const total = TABLES.length;
  const avgWeekend = TABLES.reduce((x, t) => x + t.price[0], 0) / total;
  const avgThu = TABLES.reduce((x, t) => x + t.price[1], 0) / total;

  // Punto de partida
  const week = { thu: total * a.occupancy.thu, fri: total * a.occupancy.fri, sat: total * a.occupancy.sat };
  const tablesWeek = week.thu + week.fri + week.sat;
  const seasonTables = tablesWeek * a.weeksPerSeason;
  const baseRevenue = a.weeksPerSeason * (week.thu * avgThu + (week.fri + week.sat) * avgWeekend) * (1 + a.extraSpend);
  const capacitySeason = total * 3 * a.weeksPerSeason;
  const freeSeason = capacitySeason - seasonTables;

  // Valor de una mesa extra: se vende en noches con hueco, en las zonas más baratas
  const incPrice = Object.entries(a.incrementalMix).reduce((x, [z, w]) => x + w * (zones[z]?.thuAvg ?? 0), 0);
  const incRevenuePerTable = incPrice * (1 + a.extraSpend);

  // Palancas
  const titulares = seasonTables * a.uniqueRatio;
  const reactTables = titulares * s.optIn * a.lapsedShare * a.campaignsPerSeason * s.reactConv * a.incrementality.reactivation;
  const contacts = titulares * s.optIn * (1 + a.guestsPerTable * s.guestCapture);
  const birthdays = contacts * a.birthdayWindow;
  const birthdayTables = birthdays * s.birthdayConv * a.incrementality.birthday;
  const recoveredTables = seasonTables * s.recovered;
  const extraTables = reactTables + birthdayTables + recoveredTables;

  const tablesRevenue = extraTables * incRevenuePerTable;
  const upsellRevenue = baseRevenue * s.flowShare * s.upsell;
  const extraRevenue = tablesRevenue + upsellRevenue;

  const offerCost = (reactTables + birthdayTables) * incRevenuePerTable * a.offerCostPct;
  const messages = contacts * a.msgsPerContactSeason;
  const waCost = messages * a.waCostPerMsg;
  const serviceCost = a.fees.setup + a.fees.monthly * a.fees.months + waCost;

  const grossProfit = extraRevenue * a.grossMargin - offerCost;
  const net = grossProfit - serviceCost;
  const marginPerTable = incRevenuePerTable * (a.grossMargin - a.offerCostPct);
  const breakEvenTables = serviceCost / marginPerTable;

  return {
    scenario,
    inputs: { assumptions: a, levers: s },
    baseline: { totalTables: total, tablesWeek, seasonTables, baseRevenue, capacitySeason, freeSeason, avgWeekend, avgThu, titulares },
    levers: {
      reactivation: { tables: reactTables, revenue: reactTables * incRevenuePerTable },
      birthday: { tables: birthdayTables, revenue: birthdayTables * incRevenuePerTable, birthdays },
      recovery: { tables: recoveredTables, revenue: recoveredTables * incRevenuePerTable },
      upsell: { tables: 0, revenue: upsellRevenue },
    },
    contacts,
    messages,
    extraTables,
    extraRevenue,
    pctTables: extraTables / seasonTables,
    pctRevenue: extraRevenue / baseRevenue,
    offerCost,
    waCost,
    serviceCost,
    grossProfit,
    net,
    roi: net / serviceCost,
    incRevenuePerTable,
    breakEvenTables,
    breakEvenPerWeek: breakEvenTables / a.weeksPerSeason,
    fitsInFreeCapacity: extraTables <= freeSeason,
    paybackMonths: serviceCost > 0 && grossProfit > 0 ? (serviceCost / (grossProfit / a.fees.months)) : null,
  };
}

export const runAll = () => Object.fromEntries(Object.keys(SCENARIOS).map((k) => [k, runModel(k)]));

const group = (s) => s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
export const fmtEUR = (n, d = 0) => {
  const [i, f] = Math.abs(n).toFixed(d).split('.');
  return `${n < 0 ? '-' : ''}${group(i)}${f ? ',' + f : ''} €`;
};
export const fmtPct = (n, d = 1) => `${(n * 100).toFixed(d).replace('.', ',')} %`;
export const fmtNum = (n, d = 0) => {
  const [i, f] = n.toFixed(d).split('.');
  return group(i) + (f ? ',' + f : '');
};
