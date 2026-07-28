/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const settings = app.findCollectionByNameOrId("yieldsetts01");

    // Add estimate_number_format if not present
    try {
      settings.fields.addAt(settings.fields.length - 2, new Field({
        "hidden": false,
        "id": "fld_set_enf",
        "max": 0,
        "min": 0,
        "name": "estimate_number_format",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      }));
    } catch (_) {}

    // Add estimate_next_number if not present
    try {
      settings.fields.addAt(settings.fields.length - 2, new Field({
        "hidden": false,
        "id": "fld_set_enn",
        "max": null,
        "min": 1,
        "name": "estimate_next_number",
        "onlyInt": true,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      }));
    } catch (_) {}

    app.save(settings);
  } catch (_) {
    // settings collection doesn't exist — skip
  }
}, (app) => {
  try {
    const settings = app.findCollectionByNameOrId("yieldsetts01");
    settings.fields.removeById("fld_set_enf");
    settings.fields.removeById("fld_set_enn");
    app.save(settings);
  } catch (_) {}
});
