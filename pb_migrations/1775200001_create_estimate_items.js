/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Skip if estimate_items collection already exists
  try { app.findCollectionByNameOrId("_pb_est_items_"); return; } catch (_) {}

  const collection = new Collection({
    "id": "_pb_est_items_",
    "name": "estimate_items",
    "type": "base",
    "system": false,
    "fields": [
      {
        "cascadeDelete": true,
        "collectionId": "_pb_estimates_",
        "hidden": false,
        "id": "fld_eit_est",
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
        "id": "fld_eit_dsc",
        "max": 0,
        "min": 0,
        "name": "description",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "fld_eit_qty",
        "max": null,
        "min": 0,
        "name": "quantity",
        "onlyInt": false,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "hidden": false,
        "id": "fld_eit_upr",
        "max": null,
        "min": 0,
        "name": "unit_price",
        "onlyInt": false,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      }
    ]
  });
  app.save(collection);
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("_pb_est_items_");
    app.delete(col);
  } catch (_) {}
});
