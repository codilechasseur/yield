/// <reference path="../pb_data/types.d.ts" />
// Tax estimate settings: province (enables bracket-based income tax + CPP),
// GST/HST filing frequency, and per-year exchange rates for converting
// foreign-currency revenue into the income tax base ({"2026": {"USD": 1.37}}).
migrate((app) => {
  let collection;
  try {
    collection = app.findCollectionByNameOrId("yieldsetts01");
  } catch (_) {
    return; // collection doesn't exist on this instance — pb_schema.json will create it with these fields
  }

  for (const def of [
    {
      "autogeneratePattern": "",
      "hidden": false,
      "id": "fld_set_taxprov",
      "max": 2,
      "min": 0,
      "name": "tax_province",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    },
    {
      "hidden": false,
      "id": "fld_set_gstfreq",
      "maxSelect": 1,
      "name": "gst_filing_frequency",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "select",
      "values": [
        "annual",
        "quarterly",
        "monthly"
      ]
    },
    {
      "hidden": false,
      "id": "fld_set_fxrates",
      "maxSize": 0,
      "name": "fx_rates",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "json"
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
    collection = app.findCollectionByNameOrId("yieldsetts01");
  } catch (_) {
    return;
  }
  
  for (const id of ["fld_set_taxprov", "fld_set_gstfreq", "fld_set_fxrates"]) collection.fields.removeById(id);
  app.save(collection);
});
