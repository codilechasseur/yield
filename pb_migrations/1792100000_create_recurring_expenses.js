/// <reference path="../pb_data/types.d.ts" />
// Schedules for recurring expenses (subscriptions, rent, phone…). Each due
// charge is materialised as a normal expense by src/lib/recurring.server.ts.
// Superuser-only like every other collection (null rules).
migrate((app) => {
  try { app.findCollectionByNameOrId("yieldrecexp001"); return; } catch (_) {}

  const collection = new Collection({
    "id": "yieldrecexp001",
    "name": "recurring_expenses",
    "type": "base",
    "system": false,
    "fields": [
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "fld_rex_dsc",
        "max": 0,
        "min": 0,
        "name": "description",
        "pattern": "",
        "presentable": true,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "fld_rex_amt",
        "max": null,
        "min": 0,
        "name": "amount",
        "onlyInt": false,
        "presentable": false,
        "required": true,
        "system": false,
        "type": "number"
      },
      {
        "hidden": false,
        "id": "fld_rex_gst",
        "max": null,
        "min": 0,
        "name": "gst_paid",
        "onlyInt": false,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "hidden": false,
        "id": "fld_rex_cat",
        "maxSelect": 1,
        "name": "category",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "select",
        "values": [
          "software",
          "office",
          "supplies",
          "telephone",
          "professional",
          "fees",
          "advertising",
          "meals",
          "travel",
          "vehicle",
          "home_office",
          "rent",
          "insurance",
          "interest",
          "repairs",
          "other"
        ]
      },
      {
        "hidden": false,
        "id": "fld_rex_bus",
        "max": 100,
        "min": 0,
        "name": "business_use_percent",
        "onlyInt": false,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "fld_rex_not",
        "max": 0,
        "min": 0,
        "name": "notes",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "fld_rex_frq",
        "maxSelect": 1,
        "name": "frequency",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "select",
        "values": [
          "weekly",
          "monthly",
          "quarterly",
          "yearly"
        ]
      },
      {
        "hidden": false,
        "id": "fld_rex_start",
        "max": "",
        "min": "",
        "name": "start_date",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "date"
      },
      {
        "hidden": false,
        "id": "fld_rex_end",
        "max": "",
        "min": "",
        "name": "end_date",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "date"
      },
      {
        "hidden": false,
        "id": "fld_rex_last",
        "max": "",
        "min": "",
        "name": "last_generated",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "date"
      },
      {
        "hidden": false,
        "id": "fld_rex_created",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "fld_rex_updated",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "indexes": [],
    "listRule": null,
    "viewRule": null,
    "createRule": null,
    "updateRule": null,
    "deleteRule": null
  });
  app.save(collection);
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("yieldrecexp001"));
  } catch (_) {}
});
