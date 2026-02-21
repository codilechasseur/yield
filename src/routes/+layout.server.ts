export async function load({ locals }) {
	return {
		authEnabled: locals.authEnabled ?? false
	};
}
