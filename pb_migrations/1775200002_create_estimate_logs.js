/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Skip if estimate_logs collection already exists
  try { app.findCollectionByNameOrId("_pb_est_logs_"); return; } catch (_) {}

  const collection = new Collection({
    "id": "_pb_est_logs_",
    "name": "estimate_logs",
    "type": "base",
    "system": false,
    "fields": [
      {
        "cascadeDelete": true,
        "collectionId": "_pb_estimates_",
        "hidden": false,
        "id": "fld_elg_est",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "estimate",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "hidden": false,
        "id": "fld_elg_act",
        "maxSelect": 1,
        "name": "action",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "select",
        "values": [
          "status_changed",
          "note",
          "edited",
          "email_sent",
          "estimate_created",
          "converted_to_invoice"
        ]
      },
      {
        "hidden": false,
        "id": "fld_elg_det",
        "max": 0,
        "min": 0,
        "name": "detail",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "fld_elg_occ",
        "name": "occurred_at",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "date"
      }
    ]
  });
  app.save(collection);
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("_pb_est_logs_");
    app.delete(col);
  } catch (_) {}
});
