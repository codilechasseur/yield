/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const collection = app.findCollectionByNameOrId("_pb_invoices_");
    app.delete(collection);
  } catch (_) {
    // collection doesn't exist or has relation references — skip
  }
}, (app) => {
  const collection = new Collection({
    "createRule": "",
    "deleteRule": "",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "cascadeDelete": false,
        "collectionId": "_pb_clients_",
        "hidden": false,
        "id": "field_inv_client",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "client",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "field_inv_number",
        "max": 0,
        "min": 1,
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
        "id": "field_inv_issue_date",
        "max": "",
        "min": "",
        "name": "issue_date",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "date"
      },
      {
        "hidden": false,
        "id": "field_inv_due_date",
        "max": "",
        "min": "",
        "name": "due_date",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "date"
      },
      {
        "hidden": false,
        "id": "field_inv_status",
        "maxSelect": 1,
        "name": "status",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "select",
        "values": [
          "draft",
          "sent",
          "paid",
          "overdue"
        ]
      },
      {
        "hidden": false,
        "id": "field_inv_tax",
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
        "autogeneratePattern": "",
        "hidden": false,
        "id": "field_inv_notes",
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
    ],
    "id": "_pb_invoices_",
    "indexes": [
      "CREATE UNIQUE INDEX `idx_invoice_number` ON `invoices` (`number`)"
    ],
    "listRule": "",
    "name": "invoices",
    "system": false,
    "type": "base",
    "updateRule": "",
    "viewRule": ""
  });

  return app.save(collection);
})
