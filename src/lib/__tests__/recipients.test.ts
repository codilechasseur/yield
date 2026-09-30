import { describe, it, expect } from 'vitest';
import { parseEmailList, resolveRecipients } from '../recipients.js';

describe('parseEmailList', () => {
	it('splits and trims comma-separated addresses', () => {
		expect(parseEmailList(' a@x.com ,b@y.com')).toEqual(['a@x.com', 'b@y.com']);
	});

	it('drops entries without @', () => {
		expect(parseEmailList('a@x.com, nope, ,')).toEqual(['a@x.com']);
	});

	it('returns [] for empty, null and undefined', () => {
		expect(parseEmailList('')).toEqual([]);
		expect(parseEmailList(null)).toEqual([]);
		expect(parseEmailList(undefined)).toEqual([]);
	});
});

describe('resolveRecipients', () => {
	it('uses selected contacts plus extras', () => {
		expect(
			resolveRecipients({ contactEmails: ['c@client.com'], extraRaw: 'me@home.com' })
		).toEqual(['c@client.com', 'me@home.com']);
	});

	it('does not fall back to the client email when no contacts are selected', () => {
		expect(
			resolveRecipients({ contactEmails: [], clientEmail: 'billing@client.com', extraRaw: 'me@home.com' })
		).toEqual(['me@home.com']);
	});

	it('includes the client email only when explicitly requested', () => {
		expect(
			resolveRecipients({ contactEmails: [], clientEmail: 'billing@client.com', includeClientEmail: true })
		).toEqual(['billing@client.com']);
	});

	it('ignores includeClientEmail when the client has no email', () => {
		expect(resolveRecipients({ contactEmails: [], clientEmail: '', includeClientEmail: true })).toEqual([]);
		expect(resolveRecipients({ contactEmails: [], clientEmail: null, includeClientEmail: true })).toEqual([]);
	});

	it('de-duplicates across sources', () => {
		expect(
			resolveRecipients({
				contactEmails: ['a@x.com', 'a@x.com'],
				clientEmail: 'a@x.com',
				includeClientEmail: true,
				extraRaw: 'a@x.com, b@x.com'
			})
		).toEqual(['a@x.com', 'b@x.com']);
	});

	it('returns [] when nothing is selected', () => {
		expect(resolveRecipients({ contactEmails: [] })).toEqual([]);
	});
});
