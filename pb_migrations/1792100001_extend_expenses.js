/// <reference path="../pb_data/types.d.ts" />
// Expenses gain a CRA T2125 category, a business-use percentage, a receipt
// attachment (protected: served only through /api/expenses/[id]/receipt) and
// a link to the recurring schedule that created them. The unique index stops
// two concurrent runs from creating the same recurring charge twice.
migrate((app) => {
  let collection;
  try {
    collection = app.findCollectionByNameOrId("_pb_expenses_");
  } catch (_) {
    return; // collection doesn't exist on this instance — pb_schema.json will create it with these fields
  }

  for (const def of [
    {
      "hidden": false,
      "id": "fld_exp_cat",
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
      "id": "fld_exp_bus",
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
      "hidden": false,
      "id": "fld_exp_rcpt",
      "maxSelect": 1,
      "maxSize": 10485760,
      "mimeTypes": [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/heic",
        "image/heif"
      ],
      "name": "receipt",
      "presentable": false,
      "protected": true,
      "required": false,
      "system": false,
      "thumbs": null,
      "type": "file"
    },
    {
      "cascadeDelete": false,
      "collectionId": "yieldrecexp001",
      "hidden": false,
      "id": "fld_exp_rec",
      "maxSelect": 1,
      "minSelect": 0,
      "name": "recurring",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "relation"
    }
  ]) {
    if (collection.fields.find((f) => f.name === def.name)) continue;
    // Keep the autodate fields last
    collection.fields.addAt(Math.max(0, collection.fields.length - 2), new Field(def));
  }
  for (const index of [
    "CREATE INDEX idx_exp_date ON expenses (expense_date)",
    "CREATE UNIQUE INDEX idx_exp_recurring_date ON expenses (recurring, expense_date) WHERE recurring != ''"
  ]) {
    if (!collection.indexes.includes(index)) collection.indexes.push(index);
  }
  app.save(collection);
}, (app) => {
  let collection;
  try {
    collection = app.findCollectionByNameOrId("_pb_expenses_");
  } catch (_) {
    return;
  }
  collection.indexes = collection.indexes.filter((i) => !["CREATE INDEX idx_exp_date ON expenses (expense_date)", "CREATE UNIQUE INDEX idx_exp_recurring_date ON expenses (recurring, expense_date) WHERE recurring != ''"].includes(i));
  for (const id of ["fld_exp_cat", "fld_exp_bus", "fld_exp_rcpt", "fld_exp_rec"]) collection.fields.removeById(id);
  app.save(collection);
});
