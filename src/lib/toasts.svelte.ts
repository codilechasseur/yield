export type ToastType = 'success' | 'error';

export interface Toast {
	id: number;
	message: string;
	type: ToastType;
}

let list = $state<Toast[]>([]);
let _next = 0;

export function addToast(message: string, type: ToastType = 'success', duration = 4000) {
	const id = _next++;
	list.push({ id, message, type });
	setTimeout(() => {
		const i = list.findIndex((t) => t.id === id);
		if (i !== -1) list.splice(i, 1);
	}, duration);
}

export function removeToast(id: number) {
	const i = list.findIndex((t) => t.id === id);
	if (i !== -1) list.splice(i, 1);
}

/** Remove all toasts — used for test isolation. */
export function clearToasts() {
	list.splice(0, list.length);
}

export { list as toasts };
