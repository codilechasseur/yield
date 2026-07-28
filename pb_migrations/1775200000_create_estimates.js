/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Skip if estimates collection already exists
  try { app.findCollectionByNameOrId("_pb_estimates_"); return; } catch (_) {}

  const collection = new Collection({
    "id": "_pb_estimates_",
    "name": "estimates",
    "type": "base",
    "system": false,
    "fields": [
      {
        "cascadeDelete": false,
        "collectionId": "_pb_clients_",
        "hidden": false,
        "id": "fld_est_cli",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "client",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "hidden": false,
        "id": "fld_est_num",
        "max": 0,
        "min": 0,
        "name": "number",
        "pattern": "",
        "presentable": true,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "fld_est_iss",
        "name": "issue_date",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "date"
      },
      {
        "hidden": false,
        "id": "fld_est_exp",
        "name": "expiry_date",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "date"
      },
      {
        "hidden": false,
        "id": "fld_est_sta",
        "maxSelect": 1,
        "name": "status",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "select",
        "values": ["draft", "sent", "accepted", "declined", "expired"]
      },
      {
        "hidden": false,
        "id": "fld_est_tax",
        "max": 100,
        "min": 0,
        "name": "tax_percent",
        "onlyInt": false,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "hidden": false,
        "id": "fld_est_not",
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
        "id": "fld_est_inv",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "invoice",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "text"
      }
    ]
  });
  app.save(collection);
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("_pb_estimates_");
    app.delete(col);
  } catch (_) {}
});
