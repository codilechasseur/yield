import { describe, it, expect } from 'vitest';
import {
	HOME_COST_TYPES,
	isHomeCostType,
	homeCostLabel,
	parseHomeOfficeConfig,
	homeConfigForYear,
	homeOfficeShare,
	summarizeHomeOffice
} from '../home-office.js';
import type { HomeCostType } from '../types.js';

const cost = (home_cost_type: HomeCostType | '', amount: number, description = '', business_use_percent = 100) => ({
	home_cost_type,
	amount,
	description,
	business_use_percent
});

/** A real 2025 T2125 Part 7: 306 of 1,475 sq ft, used only for business. */
const config2025 = { home_area: 1475, workspace_area: 306, business_time_percent: 100, carryforward: 0 };
const costs2025 = [
	cost('heat', 468),
	cost('electricity', 1668),
	cost('insurance', 600),
	cost('mortgage_interest', 30761.2),
	cost('property_taxes', 2463.17),
	cost('other', 1915, 'Internet/Phone')
];

describe('HOME_COST_TYPES / isHomeCostType / homeCostLabel', () => {
	it('lists the Part 7 lines in form order', () => {
		expect(HOME_COST_TYPES.map((t) => t.value)).toEqual([
			'heat', 'electricity', 'insurance', 'maintenance', 'mortgage_interest', 'property_taxes', 'rent', 'other'
		]);
	});

	it('recognises known types and labels unknown ones as Other', () => {
		expect(isHomeCostType('heat')).toBe(true);
		expect(isHomeCostType('water')).toBe(false);
		expect(isHomeCostType('')).toBe(false);
		expect(homeCostLabel('mortgage_interest')).toBe('Mortgage interest');
		expect(homeCostLabel('')).toBe('Other expenses');
		expect(homeCostLabel(undefined)).toBe('Other expenses');
	});
});

describe('parseHomeOfficeConfig', () => {
	it('accepts a valid setup, defaulting time to 100% and carryforward to 0', () => {
		expect(parseHomeOfficeConfig({ home_area: '1475', workspace_area: '306', business_time_percent: '', carryforward: '' })).toEqual(config2025);
	});

	it('rejects missing, zero, or inconsistent areas', () => {
		expect(parseHomeOfficeConfig(null)).toBeNull();
		expect(parseHomeOfficeConfig('x')).toBeNull();
		expect(parseHomeOfficeConfig({ home_area: 0, workspace_area: 10 })).toBeNull();
		expect(parseHomeOfficeConfig({ home_area: 100, workspace_area: 0 })).toBeNull();
		expect(parseHomeOfficeConfig({ home_area: 100, workspace_area: 101 })).toBeNull();
		expect(parseHomeOfficeConfig({ home_area: 'abc', workspace_area: 10 })).toBeNull();
	});

	it('rejects out-of-range time or a negative carryforward', () => {
		expect(parseHomeOfficeConfig({ home_area: 100, workspace_area: 10, business_time_percent: 0 })).toBeNull();
		expect(parseHomeOfficeConfig({ home_area: 100, workspace_area: 10, business_time_percent: 120 })).toBeNull();
		expect(parseHomeOfficeConfig({ home_area: 100, workspace_area: 10, carryforward: -1 })).toBeNull();
	});
});

describe('homeConfigForYear / homeOfficeShare', () => {
	it('reads a year from the settings map', () => {
		expect(homeConfigForYear({ '2025': config2025 }, 2025)).toEqual(config2025);
		expect(homeConfigForYear({ '2025': config2025 }, 2026)).toBeNull();
		expect(homeConfigForYear(null, 2025)).toBeNull();
	});

	it('multiplies the area share by business time', () => {
		expect(homeOfficeShare(config2025)).toBeCloseTo(306 / 1475);
		expect(homeOfficeShare({ ...config2025, business_time_percent: 50 })).toBeCloseTo(306 / 1475 / 2);
		expect(homeOfficeShare(null)).toBeNull();
	});
});

describe('summarizeHomeOffice', () => {
	it('matches the 2025 CRA form to the cent', () => {
		const s = summarizeHomeOffice({ expenses: costs2025, config: config2025, incomeBeforeHome: 100_000 });
		expect(s.subtotal).toBe(37875.37);
		expect(s.personalPart).toBe(30017.84);
		expect(s.businessPart).toBe(7857.53);
		expect(s.deductible).toBe(7857.53);
		expect(s.carriedForward).toBe(0);
		expect(s.lines.find((l) => l.type === 'mortgage_interest')?.amount).toBe(30761.2);
		expect(s.lines.find((l) => l.type === 'maintenance')?.amount).toBe(0);
		expect(s.lines.find((l) => l.type === 'other')?.descriptions).toEqual(['Internet/Phone']);
		expect(s.count).toBe(6);
	});

	it('flags phone or internet logged as an "other" home cost', () => {
		expect(summarizeHomeOffice({ expenses: costs2025, config: config2025, incomeBeforeHome: 1 }).phoneOrInternetInOther).toBe(true);
		expect(summarizeHomeOffice({ expenses: [cost('other', 50, 'Water')], config: config2025, incomeBeforeHome: 1 }).phoneOrInternetInOther).toBe(false);
	});

	it('limits the deduction to income and carries the rest forward', () => {
		const s = summarizeHomeOffice({ expenses: costs2025, config: { ...config2025, carryforward: 500 }, incomeBeforeHome: 3_000 });
		expect(s.carryforwardIn).toBe(500);
		expect(s.available).toBe(8357.53);
		expect(s.limit).toBe(3_000);
		expect(s.deductible).toBe(3_000);
		expect(s.carriedForward).toBe(5357.53);
	});

	it('deducts nothing in a loss year', () => {
		const s = summarizeHomeOffice({ expenses: costs2025, config: config2025, incomeBeforeHome: -2_000 });
		expect(s.limit).toBe(0);
		expect(s.deductible).toBe(0);
		expect(s.carriedForward).toBe(7857.53);
	});

	it("falls back to each expense's business-use % without a setup", () => {
		const s = summarizeHomeOffice({
			expenses: [cost('electricity', 1000, '', 20), cost('', 500, 'Water', 0)],
			config: null,
			incomeBeforeHome: 50_000
		});
		expect(s.share).toBeNull();
		expect(s.businessPart).toBe(700); // 20% of 1,000 + 100% of 500 (0 means fully business)
		expect(s.lines.find((l) => l.type === 'other')?.amount).toBe(500);
	});

	it('is all zeros with no costs', () => {
		const s = summarizeHomeOffice({ expenses: [], config: config2025, incomeBeforeHome: 10_000 });
		expect(s).toMatchObject({ count: 0, subtotal: 0, businessPart: 0, deductible: 0, carriedForward: 0 });
		expect(s.lines).toHaveLength(8);
	});
});
