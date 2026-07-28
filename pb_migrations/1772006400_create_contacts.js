/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Skip if contacts collection already exists (e.g. created via pb_schema.json import)
  try { app.findCollectionByNameOrId("_pb_contacts_"); return; } catch (_) {}

  const collection = new Collection({
    "id": "_pb_contacts_",
    "name": "contacts",
    "type": "base",
    "system": false,
    "fields": [
      {
        "cascadeDelete": true,
        "collectionId": "_pb_clients_",
        "hidden": false,
        "id": "fld_con_cli",
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
        "id": "fld_con_fn",
        "max": 0,
        "min": 0,
        "name": "first_name",
        "pattern": "",
        "presentable": true,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "fld_con_ln",
        "max": 0,
        "min": 0,
        "name": "last_name",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "exceptDomains": [],
        "hidden": false,
        "id": "fld_con_em",
        "name": "email",
        "onlyDomains": [],
        "presentable": false,
        "required": false,
        "system": false,
        "type": "email"
      },
      {
        "hidden": false,
        "id": "fld_con_ttl",
        "max": 0,
        "min": 0,
        "name": "title",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "fld_con_ph",
        "max": 0,
        "min": 0,
        "name": "phone",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "fld_con_hvid",
        "max": 0,
        "min": 0,
        "name": "harvest_id",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "fld_con_created",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "fld_con_updated",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "indexes": [
      "CREATE UNIQUE INDEX idx_contact_harvest_id ON contacts (harvest_id) WHERE harvest_id != \"\""
    ],
    "listRule": "",
    "viewRule": "",
    "createRule": "",
    "updateRule": "",
    "deleteRule": ""
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("_pb_contacts_");
  return app.delete(collection);
});
