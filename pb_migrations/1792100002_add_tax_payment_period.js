/// <reference path="../pb_data/types.d.ts" />
// The GST/HST period or tax year a remittance applies to ("2026-Q3", "2026").
// Payments are often made after the period ends — e.g. 2025's balance paid in
// April 2026 — so payment_date alone can't say which year it settles.
migrate((app) => {
  let collection;
  try {
    collection = app.findCollectionByNameOrId("taxpayments001");
  } catch (_) {
    return; // collection doesn't exist on this instance — pb_schema.json will create it with these fields
  }

  for (const def of [
    {
      "autogeneratePattern": "",
      "hidden": false,
      "id": "fld_txp_period",
      "max": 10,
      "min": 0,
      "name": "period",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    }
  ]) {
    if (collection.fields.find((f) => f.name === def.name)) continue;
    // Keep the autodate fields last
    collection.fields.addAt(Math.max(0, collection.fields.length - 2), new Field(def));
  }
  app.save(collection);
}, (app) => {
  let collection;
  try {
    collection = app.findCollectionByNameOrId("taxpayments001");
  } catch (_) {
    return;
  }
  
  for (const id of ["fld_txp_period"]) collection.fields.removeById(id);
  app.save(collection);
});
