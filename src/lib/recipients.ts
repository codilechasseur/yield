/** Parse a comma-separated list of addresses; keeps only entries containing '@'. */
export function parseEmailList(raw: string | null | undefined): string[] {
	return (raw ?? '')
		.split(',')
		.map((e) => e.trim())
		.filter((e) => e.includes('@'));
}

interface ResolveRecipientsOptions {
	/** Emails of the contacts the user left checked in the send panel. */
	contactEmails: string[];
	/** The client's own email, used only when `includeClientEmail` is true. */
	clientEmail?: string | null;
	includeClientEmail?: boolean;
	/** Raw "Additional recipients" field value. */
	extraRaw?: string | null;
}

/**
 * Build the final, de-duplicated recipient list for a send.
 * Only what the user explicitly selected is included — unchecking every contact
 * never falls back to the client's email.
 */
export function resolveRecipients({
	contactEmails,
	clientEmail,
	includeClientEmail = false,
	extraRaw
}: ResolveRecipientsOptions): string[] {
	const primary = [...contactEmails];
	if (includeClientEmail && clientEmail) primary.push(clientEmail);
	return [...new Set([...primary, ...parseEmailList(extraRaw)].filter(Boolean))];
}
