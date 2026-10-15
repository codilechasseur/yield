/**
 * Canadian personal income tax parameters for 2025 and 2026, used to estimate
 * tax for a self-employed sole proprietor.
 *
 * Checked: 2026-10-15.
 *
 * PRIMARY SOURCES (official)
 *  [CRA-2025]  CRA, "Tax rates and income brackets used on the 2025 tax return"
 *              https://www.canada.ca/en/revenue-agency/services/tax/individuals/tax-rates-brackets/last-year.html
 *              (page modified 2026-06-25)
 *  [CRA-2026]  CRA, "Tax rates and income brackets to be used on the 2026 tax return"
 *              https://www.canada.ca/en/revenue-agency/services/tax/individuals/tax-rates-brackets/current-year.html
 *              (page modified 2026-06-25)
 *  [T4127-JAN] CRA T4127 Payroll Deductions Formulas, 122nd edition, effective 2026-01-01.
 *              Tables 8.1–8.6 cover 2026; Tables 8.22–8.27 cover 2025 (full-year values).
 *              https://www.canada.ca/en/revenue-agency/services/forms-publications/payroll/t4127-payroll-deductions-formulas/t4127-jan/t4127-jan-payroll-deductions-formulas-computer-programs.html
 *              CSV: https://www.canada.ca/content/dam/cra-arc/formspubs/pub/t4127-jan/rtsncmtrshldcnstnt-01-26e.csv
 *                   https://www.canada.ca/content/dam/cra-arc/formspubs/pub/t4127-jan/thrrtsmnts-01-26e.csv
 *  [T4127-JUL] CRA T4127, 123rd edition, effective 2026-07-01 (mid-year BC, NL and PE changes)
 *              https://www.canada.ca/en/revenue-agency/services/forms-publications/payroll/t4127-payroll-deductions-formulas/t4127-jul/t4127-jul-payroll-deductions-formulas.html
 *  [CRA-IDX]   CRA, "Indexation adjustment for personal income tax and benefit amounts" (federal BPA, thresholds)
 *              https://www.canada.ca/en/revenue-agency/services/tax/individuals/frequently-asked-questions-individuals/adjustment-personal-income-tax-benefit-amounts.html
 *  [CRA-CPP]   CRA, "CPP contribution rates, maximums and exemptions"
 *              https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/payroll-deductions-contributions/canada-pension-plan-cpp/cpp-contribution-rates-maximums-exemptions.html
 *  [RQ-RATES]  Revenu Québec, "Income Tax Rates" (2025 and 2026 tables). Direct access returns
 *              HTTP 403, so it was read from the Wayback Machine snapshot of 2026-09-03:
 *              https://web.archive.org/web/20260903050337/https://www.revenuquebec.ca/en/citizens/income-tax-return/completing-your-income-tax-return/income-tax-rates/
 *  [QC-FIN]    Ministère des Finances du Québec, "Paramètres du régime d'imposition des particuliers
 *              pour l'année d'imposition 2026" (Nov. 2025), Table 3 (2025 vs 2026 thresholds and BPA)
 *              https://cdn-contenu.quebec.ca/cdn-contenu/adm/min/finances/publications-adm/parametres/AUTFR_RegimeImpot2026.pdf
 *  [RRQ-2025]  Retraite Québec, 2025 key data: https://www.retraitequebec.gouv.qc.ca/en/benefits-amounts/2025-benefits-amounts-key-data
 *  [RRQ-2026]  Retraite Québec, contributions: https://www.retraitequebec.gouv.qc.ca/en/programs/quebec-pension-plan/work-contributions
 *              and figures: https://www.retraitequebec.gouv.qc.ca/en/programs/quebec-pension-plan/quebec-pension-plan-figures
 *  [MB-FIN]    Manitoba Finance, Personal Income Taxes: https://manitoba.ca/finance/personal/ptaxes.html
 *  [PE-FIN]    PEI Finance, Provincial Personal Income Tax (Wayback snapshot of 2026-06-16; the live site
 *              serves a bot challenge):
 *              https://web.archive.org/web/20260616144339/https://www.princeedwardisland.ca/en/information/finance-and-affordability/provincial-personal-income-tax
 *  [NL-BUD]    NL Budget 2026: https://www.gov.nl.ca/budget/2026/what-you-need-to-know/a-plan-for-lower-taxes/
 *
 * SECONDARY CROSS-CHECKS (highly reliable)
 *  [KPMG-26]   KPMG, "Federal and Provincial/Territorial Income Tax Rates and Brackets for 2026"
 *              (current as of 2026-09-30) and "Non-Refundable Tax Credit Rates and Amounts for 2026"
 *              https://assets.kpmg.com/content/dam/kpmgsites/ca/pdf/services/tax/personal-tables/ca-federal-and-provincial-territorial-income-tax-rates-and-brackets-for-2026.pdf.coredownload.inline.pdf
 *              https://assets.kpmg.com/content/dam/kpmgsites/ca/pdf/services/tax/personal-tables/ca-federal-and-provincial-territorial-non-refundable-tax-credit-rates-and-amounts-2026.pdf.coredownload.inline.pdf
 *  [TT]        TaxTips.ca provincial pages (https://www.taxtips.ca/taxrates/<prov>.htm, 2025 and 2026 tables)
 *              and NRTC tables (https://www.taxtips.ca/nrcredits/tax-credits-2026.htm, .../tax-credits-2025-base.htm)
 *
 * CONVENTIONS
 *  - `upTo` is the top of the bracket in dollars, `null` for the last bracket. Rates are fractions.
 *  - `basicPersonalAmount` is the MAXIMUM basic personal amount (BPA). Income-tested clawbacks are not
 *    modelled; each one is noted in a comment.
 *  - `lowestRate` is the rate applied to non-refundable credits, which is the lowest bracket rate everywhere.
 *  - Surtaxes, health premiums, low-income reductions and similar special items are NOT modelled,
 *    except the Ontario surtax (`surtax` below) and Ontario Health Premium (income-tax.ts).
 *    The rest are noted per jurisdiction.
 *  - Values are tax-year (full-year, annual return) figures. They are not mid-year payroll proration values.
 *    Several 2026 changes are budget PROPOSALS that CRA has already implemented (BC, NL, PE). See notes.
 */

export interface Bracket { upTo: number | null; rate: number } // rate as a fraction, e.g. 0.15; upTo = top of bracket in dollars, null for the last one
export interface Jurisdiction {
	brackets: Bracket[];
	basicPersonalAmount: number;
	/** Rate used for non-refundable credits. */
	lowestRate: number;
	/** Ontario-style surtax: each rate applies to basic provincial tax above its threshold. */
	surtax?: { threshold: number; rate: number }[];
}
export interface PensionPlan { basicExemption: number; ympe: number; yampe: number; baseRate: number /* employee base portion, e.g. 0.0495 */; firstEnhancedRate: number /* employee first-enhancement portion, e.g. 0.01 */; secondRate: number /* employee CPP2/QPP2 rate, e.g. 0.04 */ }
export interface TaxYearData {
	federal: Jurisdiction;
	/** Quebec abatement on basic federal tax (0.165) */
	quebecAbatement: number;
	/** Canada Employment Amount is NOT applicable to self-employed — omit. */
	cpp: PensionPlan;
	qpp: PensionPlan;
	provinces: Record<'AB'|'BC'|'MB'|'NB'|'NL'|'NS'|'NT'|'NU'|'ON'|'PE'|'QC'|'SK'|'YT', Jurisdiction>;
}

export const TAX_DATA: Record<number, TaxYearData> = {
	2025: {
		// Federal 2025. Sources: [CRA-2025], [T4127-JAN] Table 8.22, [CRA-IDX].
		// The lowest rate fell from 15% to 14% on July 1, 2025. CRA uses an effective full-year rate of
		// 14.5% for 2025, both for the first bracket and for non-refundable credits.
		// A federal "top-up tax credit" (2025–2030) keeps a 15% credit rate for non-refundable credit
		// amounts above the first bracket threshold. It is NOT modelled.
		// BPA: $16,129 is the maximum. It is clawed back linearly to $14,538 between net income of
		// $177,882 and $253,414. The clawback is NOT modelled.
		federal: {
			brackets: [
				{ upTo: 57375, rate: 0.145 },
				{ upTo: 114750, rate: 0.205 },
				{ upTo: 177882, rate: 0.26 },
				{ upTo: 253414, rate: 0.29 },
				{ upTo: null, rate: 0.33 },
			],
			basicPersonalAmount: 16129,
			lowestRate: 0.145,
		},
		// [T4127-JAN] Table 8.23 "Abatement" column for QC: 0.165.
		quebecAbatement: 0.165,
		// CPP 2025. Sources: [CRA-CPP], [T4127-JAN] Tables 8.24–8.27.
		// Self-employed people pay both halves (11.9% base+first, 8% CPP2), which is 2× these employee rates.
		cpp: {
			basicExemption: 3500,
			ympe: 71300,
			yampe: 81200,
			baseRate: 0.0495,
			firstEnhancedRate: 0.01,
			secondRate: 0.04,
		},
		// QPP 2025. Sources: [RRQ-2025] (base plan 5.4% + additional plan 1% = 6.4% employee; QPP2 4%),
		// [T4127-JAN] Tables 8.24–8.27. Self-employed people pay both halves.
		qpp: {
			basicExemption: 3500,
			ympe: 71300,
			yampe: 81200,
			baseRate: 0.054,
			firstEnhancedRate: 0.01,
			secondRate: 0.04,
		},
		provinces: {
			// Alberta 2025. Sources: [CRA-2025], [T4127-JAN] 8.22/8.23, [TT].
			// The new 8% bracket on the first $60,000 applies to the full 2025 tax year. CRA's footnote
			// "added July 1, 2025" refers to payroll timing; the T4127 2025 annual table uses 8%.
			// Credits are also computed at 8% from 2025. Alberta added a "supplemental tax credit"
			// (2% of non-refundable credit amounts above $60,000). It is NOT modelled.
			AB: {
				brackets: [
					{ upTo: 60000, rate: 0.08 },
					{ upTo: 151234, rate: 0.10 },
					{ upTo: 181481, rate: 0.12 },
					{ upTo: 241974, rate: 0.13 },
					{ upTo: 362961, rate: 0.14 },
					{ upTo: null, rate: 0.15 },
				],
				basicPersonalAmount: 22323,
				lowestRate: 0.08,
			},
			// British Columbia 2025. Sources: [CRA-2025], [T4127-JAN], [TT].
			// The BC tax reduction (a low-income credit) is NOT modelled.
			BC: {
				brackets: [
					{ upTo: 49279, rate: 0.0506 },
					{ upTo: 98560, rate: 0.077 },
					{ upTo: 113158, rate: 0.105 },
					{ upTo: 137407, rate: 0.1229 },
					{ upTo: 186306, rate: 0.147 },
					{ upTo: 259829, rate: 0.168 },
					{ upTo: null, rate: 0.205 },
				],
				basicPersonalAmount: 12932,
				lowestRate: 0.0506,
			},
			// Manitoba 2025. Sources: [MB-FIN] (brackets $47,000 / $100,000, "indexation paused effective 2025"),
			// [T4127-JAN] Table 8.22 and "What's new" (maximum BPAMB $15,780, not indexed), [TT].
			// NOTE: CRA's "last-year" rates page [CRA-2025] shows $47,564 / $101,200. Those are the
			// pre-freeze indexed values and conflict with Manitoba Finance and CRA's own T4127, so they
			// were NOT used.
			// BPA clawback: the BPA falls linearly to $0 between net income of $200,000 and $400,000
			// (from 2025). It is NOT modelled.
			MB: {
				brackets: [
					{ upTo: 47000, rate: 0.108 },
					{ upTo: 100000, rate: 0.1275 },
					{ upTo: null, rate: 0.174 },
				],
				basicPersonalAmount: 15780,
				lowestRate: 0.108,
			},
			// New Brunswick 2025. Sources: [CRA-2025], [T4127-JAN], [TT]. The low-income tax reduction is NOT modelled.
			NB: {
				brackets: [
					{ upTo: 51306, rate: 0.094 },
					{ upTo: 102614, rate: 0.14 },
					{ upTo: 190060, rate: 0.16 },
					{ upTo: null, rate: 0.195 },
				],
				basicPersonalAmount: 13396,
				lowestRate: 0.094,
			},
			// Newfoundland and Labrador 2025. Sources: [CRA-2025], [T4127-JAN], [TT].
			// The low-income tax reduction is NOT modelled.
			NL: {
				brackets: [
					{ upTo: 44192, rate: 0.087 },
					{ upTo: 88382, rate: 0.145 },
					{ upTo: 157792, rate: 0.158 },
					{ upTo: 220910, rate: 0.178 },
					{ upTo: 282214, rate: 0.198 },
					{ upTo: 564429, rate: 0.208 },
					{ upTo: 1128858, rate: 0.213 },
					{ upTo: null, rate: 0.218 },
				],
				basicPersonalAmount: 11067,
				lowestRate: 0.087,
			},
			// Nova Scotia 2025. Sources: [CRA-2025], [T4127-JAN], [TT].
			// From 2025 the BPA is a flat $11,744. The old income-tested $3,000 supplement was removed.
			// The low-income tax reduction is NOT modelled.
			NS: {
				brackets: [
					{ upTo: 30507, rate: 0.0879 },
					{ upTo: 61015, rate: 0.1495 },
					{ upTo: 95883, rate: 0.1667 },
					{ upTo: 154650, rate: 0.175 },
					{ upTo: null, rate: 0.21 },
				],
				basicPersonalAmount: 11744,
				lowestRate: 0.0879,
			},
			// Northwest Territories 2025. Sources: [CRA-2025], [T4127-JAN], [TT].
			NT: {
				brackets: [
					{ upTo: 51964, rate: 0.059 },
					{ upTo: 103930, rate: 0.086 },
					{ upTo: 168967, rate: 0.122 },
					{ upTo: null, rate: 0.1405 },
				],
				basicPersonalAmount: 17842,
				lowestRate: 0.059,
			},
			// Nunavut 2025. Sources: [CRA-2025], [T4127-JAN], [TT].
			NU: {
				brackets: [
					{ upTo: 54707, rate: 0.04 },
					{ upTo: 109413, rate: 0.07 },
					{ upTo: 177881, rate: 0.09 },
					{ upTo: null, rate: 0.115 },
				],
				basicPersonalAmount: 19274,
				lowestRate: 0.04,
			},
			// Ontario 2025. Sources: [CRA-2025], [T4127-JAN] 8.22/8.23, [TT].
			// NOT modelled: the Ontario tax reduction (low income). The Health Premium is applied in income-tax.ts.
			// The $150,000 and $220,000 thresholds are not indexed.
			ON: {
				brackets: [
					{ upTo: 52886, rate: 0.0505 },
					{ upTo: 105775, rate: 0.0915 },
					{ upTo: 150000, rate: 0.1116 },
					{ upTo: 220000, rate: 0.1216 },
					{ upTo: null, rate: 0.1316 },
				],
				basicPersonalAmount: 12747,
				lowestRate: 0.0505,
				// Surtax: 20% of basic Ontario tax above $5,710 plus 36% above $7,307 ([T4127-JAN] Table 8.23 / [TT]).
				surtax: [
					{ threshold: 5710, rate: 0.2 },
					{ threshold: 7307, rate: 0.36 },
				],
			},
			// Prince Edward Island 2025. Sources: [CRA-2025], [T4127-JAN], [TT].
			// PEI does not index. The low-income tax reduction is NOT modelled. PEI has had no surtax since 2024.
			PE: {
				brackets: [
					{ upTo: 33328, rate: 0.095 },
					{ upTo: 64656, rate: 0.1347 },
					{ upTo: 105000, rate: 0.166 },
					{ upTo: 140000, rate: 0.1762 },
					{ upTo: null, rate: 0.19 },
				],
				basicPersonalAmount: 14650,
				lowestRate: 0.095,
			},
			// Quebec 2025. Sources: [RQ-RATES] (rates and thresholds), [QC-FIN] Table 3 (thresholds and
			// BPA $18,571). Quebec credits are computed at 14%.
			// NOT modelled: the Health Services Fund (FSS) contribution on self-employment and other
			// non-employment income, QPIP premiums for the self-employed, and Quebec's own deduction
			// for the employer half of QPP.
			// The federal side for QC residents uses the 16.5% abatement (see quebecAbatement).
			QC: {
				brackets: [
					{ upTo: 53255, rate: 0.14 },
					{ upTo: 106495, rate: 0.19 },
					{ upTo: 129590, rate: 0.24 },
					{ upTo: null, rate: 0.2575 },
				],
				basicPersonalAmount: 18571,
				lowestRate: 0.14,
			},
			// Saskatchewan 2025. Sources: [CRA-2025], [T4127-JAN], [TT].
			// The BPA includes the first +$500 Affordability Act step.
			SK: {
				brackets: [
					{ upTo: 53463, rate: 0.105 },
					{ upTo: 152750, rate: 0.125 },
					{ upTo: null, rate: 0.145 },
				],
				basicPersonalAmount: 19491,
				lowestRate: 0.105,
			},
			// Yukon 2025. Sources: [CRA-2025], [T4127-JAN], [TT].
			// The Yukon BPA mirrors the federal BPA, including the same clawback down to $14,538. The
			// clawback is NOT modelled.
			YT: {
				brackets: [
					{ upTo: 57375, rate: 0.064 },
					{ upTo: 114750, rate: 0.09 },
					{ upTo: 177882, rate: 0.109 },
					{ upTo: 500000, rate: 0.128 },
					{ upTo: null, rate: 0.15 },
				],
				basicPersonalAmount: 16129,
				lowestRate: 0.064,
			},
		},
	},

	2026: {
		// Federal 2026. Sources: [CRA-2026], [T4127-JAN] Table 8.1 and "What's new", [CRA-IDX], [KPMG-26].
		// Confirmed: the lowest rate is 14% for 2026 and later years. Credits are also computed at 14%.
		// The federal top-up tax credit (15% on credit amounts above $58,523) is NOT modelled.
		// BPA: $16,452 is the maximum. It is clawed back linearly to $14,829 between net income of
		// $181,440 and $258,482. The clawback is NOT modelled.
		federal: {
			brackets: [
				{ upTo: 58523, rate: 0.14 },
				{ upTo: 117045, rate: 0.205 },
				{ upTo: 181440, rate: 0.26 },
				{ upTo: 258482, rate: 0.29 },
				{ upTo: null, rate: 0.33 },
			],
			basicPersonalAmount: 16452,
			lowestRate: 0.14,
		},
		// [T4127-JAN] Table 8.2 "Abatement" for QC: 0.165.
		quebecAbatement: 0.165,
		// CPP 2026. Sources: [CRA-CPP], [T4127-JAN] Tables 8.3–8.6.
		// Announced for 2027 (not 2026): the base employee rate drops from 4.95% to 4.75% ([T4127-JUL]).
		cpp: {
			basicExemption: 3500,
			ympe: 74600,
			yampe: 85000,
			baseRate: 0.0495,
			firstEnhancedRate: 0.01,
			secondRate: 0.04,
		},
		// QPP 2026. Sources: [RRQ-2026] (base plan 5.3% + additional plan 1% = 6.3% employee;
		// 4% between $74,600 and $85,000), [T4127-JAN] Tables 8.3–8.6.
		qpp: {
			basicExemption: 3500,
			ympe: 74600,
			yampe: 85000,
			baseRate: 0.053,
			firstEnhancedRate: 0.01,
			secondRate: 0.04,
		},
		provinces: {
			// Alberta 2026. Sources: [CRA-2026], [T4127-JAN], [KPMG-26], [TT]. Indexation is capped at 2%.
			// The supplemental tax credit is NOT modelled.
			AB: {
				brackets: [
					{ upTo: 61200, rate: 0.08 },
					{ upTo: 154259, rate: 0.10 },
					{ upTo: 185111, rate: 0.12 },
					{ upTo: 246813, rate: 0.13 },
					{ upTo: 370220, rate: 0.14 },
					{ upTo: null, rate: 0.15 },
				],
				basicPersonalAmount: 22769,
				lowestRate: 0.08,
			},
			// British Columbia 2026. Sources: [CRA-2026], [T4127-JUL] (BC Budget, Feb 17 2026), [KPMG-26], [TT].
			// The lowest rate rises from 5.06% to 5.60% for the full 2026 tax year, and credits are also
			// computed at 5.60%. Payroll uses a prorated 6.14% for Jul–Dec 2026; that is not a tax-year rate.
			// This is a budget proposal that CRA has implemented. The maximum BC tax reduction rises to $690
			// (NOT modelled). Brackets and credits are frozen at 2026 levels for 2027–2030.
			BC: {
				brackets: [
					{ upTo: 50363, rate: 0.056 },
					{ upTo: 100728, rate: 0.077 },
					{ upTo: 115648, rate: 0.105 },
					{ upTo: 140430, rate: 0.1229 },
					{ upTo: 190405, rate: 0.147 },
					{ upTo: 265545, rate: 0.168 },
					{ upTo: null, rate: 0.205 },
				],
				basicPersonalAmount: 13216,
				lowestRate: 0.056,
			},
			// Manitoba 2026. Sources: [T4127-JAN] ("maximum BPAMB for 2026 will remain at $15,780";
			// brackets $47,000 / $100,000), [KPMG-26], [TT]. Indexation is still paused (Budget 2026: no change).
			// NOTE: [CRA-2026] lists $47,564 / $101,200, which conflicts with T4127, KPMG and Manitoba.
			// That value is not used.
			// The BPA clawback (net income $200k–$400k) is NOT modelled.
			MB: {
				brackets: [
					{ upTo: 47000, rate: 0.108 },
					{ upTo: 100000, rate: 0.1275 },
					{ upTo: null, rate: 0.174 },
				],
				basicPersonalAmount: 15780,
				lowestRate: 0.108,
			},
			// New Brunswick 2026. Sources: [CRA-2026], [T4127-JAN], [KPMG-26], [TT].
			NB: {
				brackets: [
					{ upTo: 52333, rate: 0.094 },
					{ upTo: 104666, rate: 0.14 },
					{ upTo: 193861, rate: 0.16 },
					{ upTo: null, rate: 0.195 },
				],
				basicPersonalAmount: 13664,
				lowestRate: 0.094,
			},
			// Newfoundland and Labrador 2026. Brackets: [CRA-2026], [T4127-JAN], [KPMG-26], [TT].
			// BPA: NL Budget 2026 (Apr 29 2026, [NL-BUD]) raises the BPA to $15,000. Because the change came
			// mid-year, the 2026 tax-year BPA is $13,094, per [T4127-JUL] ("from $11,188 to $13,094
			// effective January 1, 2026") and [KPMG-26]. $15,000 is a payroll-only prorated figure for
			// Jul–Dec 2026; the full $15,000 presumably applies from 2027.
			// CAVEAT: NL's own budget pages state only "$15,000" and do not give the 2026 annualized figure.
			// This is a budget proposal that CRA has implemented.
			NL: {
				brackets: [
					{ upTo: 44678, rate: 0.087 },
					{ upTo: 89354, rate: 0.145 },
					{ upTo: 159528, rate: 0.158 },
					{ upTo: 223340, rate: 0.178 },
					{ upTo: 285319, rate: 0.198 },
					{ upTo: 570638, rate: 0.208 },
					{ upTo: 1141275, rate: 0.213 },
					{ upTo: null, rate: 0.218 },
				],
				basicPersonalAmount: 13094,
				lowestRate: 0.087,
			},
			// Nova Scotia 2026. Sources: [CRA-2026], [T4127-JAN], [KPMG-26], [TT]. Indexed at 1.6%.
			NS: {
				brackets: [
					{ upTo: 30995, rate: 0.0879 },
					{ upTo: 61991, rate: 0.1495 },
					{ upTo: 97417, rate: 0.1667 },
					{ upTo: 157124, rate: 0.175 },
					{ upTo: null, rate: 0.21 },
				],
				basicPersonalAmount: 11932,
				lowestRate: 0.0879,
			},
			// Northwest Territories 2026. Sources: [CRA-2026], [T4127-JAN], [KPMG-26], [TT].
			NT: {
				brackets: [
					{ upTo: 53003, rate: 0.059 },
					{ upTo: 106009, rate: 0.086 },
					{ upTo: 172346, rate: 0.122 },
					{ upTo: null, rate: 0.1405 },
				],
				basicPersonalAmount: 18198,
				lowestRate: 0.059,
			},
			// Nunavut 2026. Sources: [CRA-2026], [T4127-JAN], [KPMG-26], [TT].
			NU: {
				brackets: [
					{ upTo: 55801, rate: 0.04 },
					{ upTo: 111602, rate: 0.07 },
					{ upTo: 181439, rate: 0.09 },
					{ upTo: null, rate: 0.115 },
				],
				basicPersonalAmount: 19659,
				lowestRate: 0.04,
			},
			// Ontario 2026. Sources: [CRA-2026], [T4127-JAN] 8.1/8.2, [KPMG-26], [TT].
			// NOT modelled: the Ontario tax reduction (low income). The Health Premium is applied in income-tax.ts.
			ON: {
				brackets: [
					{ upTo: 53891, rate: 0.0505 },
					{ upTo: 107785, rate: 0.0915 },
					{ upTo: 150000, rate: 0.1116 },
					{ upTo: 220000, rate: 0.1216 },
					{ upTo: null, rate: 0.1316 },
				],
				basicPersonalAmount: 12989,
				lowestRate: 0.0505,
				// Surtax: 20% of basic Ontario tax above $5,818 plus 36% above $7,446 ([T4127-JAN] Table 8.2 / [KPMG-26]).
				surtax: [
					{ threshold: 5818, rate: 0.2 },
					{ threshold: 7446, rate: 0.36 },
				],
			},
			// Prince Edward Island 2026. Sources: [CRA-2026], [T4127-JAN] (BPA $15,000), [T4127-JUL]
			// (new 20% bracket over $200,000 "for 2026 and subsequent years"; payroll uses a prorated 21% for
			// Jul–Dec), [PE-FIN] (2026 table identical to this one; thresholds +1.8%).
			// This is a budget proposal (PEI Bill 23) that CRA has implemented. Some budget commentaries
			// (KPMG TaxNewsFlash) said the new bracket starts in 2027, but PEI Finance, CRA and KPMG's own
			// 2026 rate table all say 2026.
			// KPMG/TaxTips print the 4th threshold as $142,250; CRA (both editions) and PEI Finance say
			// $142,520, which is used here.
			PE: {
				brackets: [
					{ upTo: 33928, rate: 0.095 },
					{ upTo: 65820, rate: 0.1347 },
					{ upTo: 106890, rate: 0.166 },
					{ upTo: 142520, rate: 0.1762 },
					{ upTo: 200000, rate: 0.19 },
					{ upTo: null, rate: 0.20 },
				],
				basicPersonalAmount: 15000,
				lowestRate: 0.095,
			},
			// Quebec 2026. Sources: [RQ-RATES] (2026 table), [QC-FIN] Table 3 (thresholds and BPA $18,952;
			// indexation 2.05%), [KPMG-26]. Rates are unchanged.
			// FSS contribution, QPIP for the self-employed, and the QPP employer-half deduction are NOT modelled.
			QC: {
				brackets: [
					{ upTo: 54345, rate: 0.14 },
					{ upTo: 108680, rate: 0.19 },
					{ upTo: 132245, rate: 0.24 },
					{ upTo: null, rate: 0.2575 },
				],
				basicPersonalAmount: 18952,
				lowestRate: 0.14,
			},
			// Saskatchewan 2026. Sources: [CRA-2026], [T4127-JAN] ("For 2026, the BPA will be $20,381"), [KPMG-26], [TT].
			SK: {
				brackets: [
					{ upTo: 54532, rate: 0.105 },
					{ upTo: 155805, rate: 0.125 },
					{ upTo: null, rate: 0.145 },
				],
				basicPersonalAmount: 20381,
				lowestRate: 0.105,
			},
			// Yukon 2026. Sources: [CRA-2026], [T4127-JAN] (BPAYT = BPAF), [KPMG-26], [TT].
			// The BPA clawback to $14,829 (mirroring the federal clawback) is NOT modelled.
			YT: {
				brackets: [
					{ upTo: 58523, rate: 0.064 },
					{ upTo: 117045, rate: 0.09 },
					{ upTo: 181440, rate: 0.109 },
					{ upTo: 500000, rate: 0.128 },
					{ upTo: null, rate: 0.15 },
				],
				basicPersonalAmount: 16452,
				lowestRate: 0.064,
			},
		},
	},
};
