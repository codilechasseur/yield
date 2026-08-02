/// <reference path="../pb_data/types.d.ts" />
// The estimates, estimate_items, estimate_logs, and expenses collections were
// created without `created`/`updated` autodate fields, so any query sorting on
// `created` (e.g. the estimate detail page, dashboard widgets) failed with 400.
// This migration adds the missing autodate fields to each of them.
migrate(
	(app) => {
		const targets = ['estimates', 'estimate_items', 'estimate_logs', 'expenses'];

		for (const name of targets) {
			let collection;
			try {
				collection = app.findCollectionByNameOrId(name);
			} catch (_) {
				continue; // collection doesn't exist — nothing to do
			}

			const has = (fieldName) => collection.fields.find((f) => f.name === fieldName);

			if (!has('created')) {
				collection.fields.add(
					new Field({
						hidden: false,
						id: `fld_${name}_created`,
						name: 'created',
						onCreate: true,
						onUpdate: false,
						presentable: false,
						system: false,
						type: 'autodate'
					})
				);
			}

			if (!has('updated')) {
				collection.fields.add(
					new Field({
						hidden: false,
						id: `fld_${name}_updated`,
						name: 'updated',
						onCreate: true,
						onUpdate: true,
						presentable: false,
						system: false,
						type: 'autodate'
					})
				);
			}

			app.save(collection);
		}
	},
	(app) => {
		const targets = ['estimates', 'estimate_items', 'estimate_logs', 'expenses'];

		for (const name of targets) {
			let collection;
			try {
				collection = app.findCollectionByNameOrId(name);
			} catch (_) {
				continue;
			}

			for (const fieldName of ['created', 'updated']) {
				const field = collection.fields.find((f) => f.name === fieldName);
				if (field) collection.fields.removeById(field.id);
			}

			app.save(collection);
		}
	}
);
