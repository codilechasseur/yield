/// <reference path="../pb_data/types.d.ts" />
// Business use of home (CRA T2125 Part 7): which Part 7 line a home cost goes
// on (expenses + recurring schedules), and the per-year setup in settings —
// {"2026": {home_area, workspace_area, business_time_percent, carryforward}}.
const TARGETS = {
  "_pb_expenses_": [
    {
      "hidden": false,
      "id": "fld_exp_home",
      "maxSelect": 1,
      "name": "home_cost_type",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "select",
      "values": [
        "heat",
        "electricity",
        "insurance",
        "maintenance",
        "mortgage_interest",
        "property_taxes",
        "rent",
        "other"
      ]
    }
  ],
  "yieldrecexp001": [
    {
      "hidden": false,
      "id": "fld_rex_home",
      "maxSelect": 1,
      "name": "home_cost_type",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "select",
      "values": [
        "heat",
        "electricity",
        "insurance",
        "maintenance",
        "mortgage_interest",
        "property_taxes",
        "rent",
        "other"
      ]
    }
  ],
  "yieldsetts01": [
    {
      "hidden": false,
      "id": "fld_set_homeoff",
      "maxSize": 0,
      "name": "home_office",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "json"
    }
  ]
};

migrate((app) => {
  for (const [collectionId, fields] of Object.entries(TARGETS)) {
    let collection;
    try {
      collection = app.findCollectionByNameOrId(collectionId);
    } catch (_) {
      continue; // collection doesn't exist on this instance — pb_schema.json will create it with these fields
    }
    for (const def of fields) {
      if (collection.fields.find((f) => f.name === def.name)) continue;
      // Keep the autodate fields last
      collection.fields.addAt(Math.max(0, collection.fields.length - 2), new Field(def));
    }
    app.save(collection);
  }
}, (app) => {
  for (const [collectionId, fields] of Object.entries(TARGETS)) {
    let collection;
    try {
      collection = app.findCollectionByNameOrId(collectionId);
    } catch (_) {
      continue;
    }
    for (const def of fields) collection.fields.removeById(def.id);
    app.save(collection);
  }
});
