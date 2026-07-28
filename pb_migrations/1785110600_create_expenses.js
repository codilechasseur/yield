/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Skip if expenses collection already exists
  try { app.findCollectionByNameOrId("_pb_expenses_"); return; } catch (_) {}

  const collection = new Collection({
    "id": "_pb_expenses_",
    "name": "expenses",
    "type": "base",
    "system": false,
    "fields": [
      {
        "hidden": false,
        "id": "fld_exp_dsc",
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
        "id": "fld_exp_amt",
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
        "id": "fld_exp_gst",
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
        "id": "fld_exp_dat",
        "name": "expense_date",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "date"
      },
      {
        "hidden": false,
        "id": "fld_exp_not",
        "max": 0,
        "min": 0,
        "name": "notes",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      }
    ]
  });
  app.save(collection);
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("_pb_expenses_");
    app.delete(col);
  } catch (_) {}
});
