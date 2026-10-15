import { describe, it, expect } from 'vitest';
import {
	PROVINCES,
	TAX_TABLE_YEARS,
	isProvince,
	provinceLabel,
	tableYearFor,
	bracketTax,
	selfEmployedPension,
	ontarioHealthPremium,
	estimateIncomeTax
} from '../income-tax.js';
import { TAX_DATA } from '../tax-data.js';

describe('tax tables', () => {
	it('cover every province in every year, with ascending brackets', () => {
		for (const year of TAX_TABLE_YEARS) {
			const data = TAX_DATA[year];
			for (const j of [data.federal, ...PROVINCES.map((p) => data.provinces[p.value])]) {
				expect(j.brackets.at(-1)!.upTo).toBeNull();
				const tops = j.brackets.slice(0, -1).map((b) => b.upTo!);
				expect([...tops].sort((a, b) => a - b)).toEqual(tops);
				expect(j.lowestRate).toBe(j.brackets[0].rate);
			}
		}
	});
});

describe('isProvince / provinceLabel', () => {
	it('knows all 13 provinces and territories', () => {
		expect(PROVINCES).toHaveLength(13);
		expect(isProvince('ON')).toBe(true);
		expect(isProvince('on')).toBe(false);
		expect(isProvince('')).toBe(false);
		expect(provinceLabel('QC')).toBe('Quebec');
		expect(provinceLabel('XX')).toBe('XX');
	});
});

describe('tableYearFor', () => {
	it('uses the exact year, or the nearest one available', () => {
		expect(tableYearFor(2026)).toBe(2026);
		expect(tableYearFor(2025)).toBe(2025);
		expect(tableYearFor(2030)).toBe(TAX_TABLE_YEARS.at(-1));
		expect(tableYearFor(2019)).toBe(TAX_TABLE_YEARS[0]);
	});
});

describe('bracketTax', () => {
	const brackets = [
		{ upTo: 10_000, rate: 0.1 },
		{ upTo: 20_000, rate: 0.2 },
		{ upTo: null, rate: 0.3 }
	];

	it('is zero for zero or negative income', () => {
		expect(bracketTax(0, brackets)).toBe(0);
		expect(bracketTax(-500, brackets)).toBe(0);
	});

	it('taxes each slice at its own rate', () => {
		expect(bracketTax(5_000, brackets)).toBe(500);
		expect(bracketTax(10_000, brackets)).toBe(1_000);
		expect(bracketTax(25_000, brackets)).toBeCloseTo(1_000 + 2_000 + 1_500);
	});
});

describe('selfEmployedPension', () => {
	const cpp2026 = TAX_DATA[2026].cpp;

	it('is zero at or below the basic exemption', () => {
		expect(selfEmployedPension(0, cpp2026).total).toBe(0);
		expect(selfEmployedPension(3_500, cpp2026).total).toBe(0);
		expect(selfEmployedPension(-100, cpp2026).total).toBe(0);
	});

	it('charges both halves (11.9%) below the YMPE', () => {
		const p = selfEmployedPension(53_500, cpp2026);
		expect(p.total).toBeCloseTo(50_000 * 0.119);
		expect(p.creditBase).toBeCloseTo(50_000 * 0.0495);
		// employer half + employee enhanced 1%
		expect(p.deduction).toBeCloseTo(50_000 * 0.0595 + 50_000 * 0.01);
	});

	it('adds CPP2 between the YMPE and YAMPE, and stops at the YAMPE', () => {
		const max = selfEmployedPension(200_000, cpp2026);
		const base = (74_600 - 3_500) * 0.119;
		const cpp2 = (85_000 - 74_600) * 0.08;
		expect(max.total).toBeCloseTo(base + cpp2);
		expect(selfEmployedPension(85_000, cpp2026).total).toBeCloseTo(max.total);
	});
});

describe('ontarioHealthPremium', () => {
	it('follows the fixed schedule', () => {
		expect(ontarioHealthPremium(20_000)).toBe(0);
		expect(ontarioHealthPremium(22_000)).toBeCloseTo(120);
		expect(ontarioHealthPremium(30_000)).toBe(300);
		expect(ontarioHealthPremium(40_000)).toBe(450);
		expect(ontarioHealthPremium(50_000)).toBe(600);
		expect(ontarioHealthPremium(72_500)).toBe(725);
		expect(ontarioHealthPremium(100_000)).toBe(750);
		expect(ontarioHealthPremium(250_000)).toBe(900);
	});
});

describe('estimateIncomeTax — brackets', () => {
	it('matches a hand calculation for Ontario 2026 at $80,000 profit', () => {
		const e = estimateIncomeTax({ netIncome: 80_000, year: 2026, province: 'ON' });
		// CPP: 71,100 × 11.9% + 5,400 × 8% = 8,892.90; deduction 5,373.45 → taxable 74,626.55
		expect(e.method).toBe('brackets');
		expect(e.pensionPlan).toBe('CPP');
		expect(e.pension).toBe(8892.9);
		expect(e.pensionDeduction).toBe(5373.45);
		expect(e.taxableIncome).toBe(74626.55);
		expect(e.federalTax).toBe(8698.44);
		// Ontario basic 3,785.12 (below surtax threshold) + $750 Health Premium
		expect(e.provincialTax).toBe(4535.12);
		expect(e.total).toBe(22126.47);
		expect(e.effectiveRate).toBeCloseTo(22126.47 / 80_000, 4);
		expect(e.tableYear).toBe(2026);
	});

	it('applies the Ontario surtax at higher incomes', () => {
		const e = estimateIncomeTax({ netIncome: 200_000, year: 2026, province: 'ON' });
		const noSurtax = TAX_DATA[2026].provinces.ON;
		const pension = selfEmployedPension(200_000, TAX_DATA[2026].cpp);
		const taxable = 200_000 - pension.deduction;
		const basic = bracketTax(taxable, noSurtax.brackets) - 0.0505 * (12_989 + pension.creditBase);
		const surtax = (basic - 5_818) * 0.2 + (basic - 7_446) * 0.36;
		expect(e.provincialTax).toBeCloseTo(basic + surtax + 750, 1);
	});

	it('owes nothing at zero profit and never goes negative', () => {
		const zero = estimateIncomeTax({ netIncome: 0, year: 2026, province: 'BC' });
		expect(zero.total).toBe(0);
		expect(zero.effectiveRate).toBe(0);
		const loss = estimateIncomeTax({ netIncome: -5_000, year: 2026, province: 'BC' });
		expect(loss.total).toBe(0);
		expect(loss.netIncome).toBe(0);
	});

	it('covers low incomes with the basic personal amount (CPP still applies)', () => {
		const e = estimateIncomeTax({ netIncome: 12_000, year: 2026, province: 'AB' });
		expect(e.incomeTax).toBe(0);
		expect(e.pension).toBeCloseTo((12_000 - 3_500) * 0.119, 2);
	});

	it('uses QPP and the federal abatement in Quebec', () => {
		const qc = estimateIncomeTax({ netIncome: 80_000, year: 2026, province: 'QC' });
		expect(qc.pensionPlan).toBe('QPP');
		const qpp = selfEmployedPension(80_000, TAX_DATA[2026].qpp);
		expect(qc.pension).toBeCloseTo(qpp.total, 2);
		// Federal tax is reduced by 16.5% compared with the same taxable income elsewhere
		const fed = TAX_DATA[2026].federal;
		const taxable = 80_000 - qpp.deduction;
		const basicFederal = bracketTax(taxable, fed.brackets) - fed.lowestRate * (fed.basicPersonalAmount + qpp.creditBase);
		expect(qc.federalTax).toBeCloseTo(basicFederal * 0.835, 1);
	});

	it('reports a marginal rate that rises with income', () => {
		const low = estimateIncomeTax({ netIncome: 40_000, year: 2026, province: 'ON' });
		const high = estimateIncomeTax({ netIncome: 300_000, year: 2026, province: 'ON' });
		expect(low.marginalRate).toBeGreaterThan(0.2);
		expect(high.marginalRate).toBeGreaterThan(0.5);
		expect(high.marginalRate).toBeLessThan(0.6);
	});

	it('falls back to the nearest tax tables for other years', () => {
		expect(estimateIncomeTax({ netIncome: 50_000, year: 2027, province: 'ON' }).tableYear).toBe(TAX_TABLE_YEARS.at(-1));
	});
});

describe('estimateIncomeTax — flat rate and unconfigured', () => {
	it('applies a flat rate when no province is set', () => {
		const e = estimateIncomeTax({ netIncome: 50_000, year: 2026, province: '', flatRate: 25 });
		expect(e).toMatchObject({ method: 'flat', incomeTax: 12_500, total: 12_500, pension: 0, effectiveRate: 0.25, marginalRate: 0.25 });
	});

	it('ignores an unknown province and uses the flat rate', () => {
		expect(estimateIncomeTax({ netIncome: 1_000, year: 2026, province: 'XX', flatRate: 10 }).method).toBe('flat');
	});

	it('returns zeros when nothing is configured', () => {
		const e = estimateIncomeTax({ netIncome: 50_000, year: 2026 });
		expect(e).toMatchObject({ method: 'none', total: 0, incomeTax: 0, netIncome: 50_000, effectiveRate: 0 });
	});
});
