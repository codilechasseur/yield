/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const collection = app.findCollectionByNameOrId("yieldsetts01")

    // add field
    collection.fields.addAt(21, new Field({
      "autogeneratePattern": "",
      "hidden": false,
      "id": "fld_set_inf",
      "max": 0,
      "min": 0,
      "name": "invoice_number_format",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    }))

    // add field
    collection.fields.addAt(22, new Field({
      "hidden": false,
      "id": "fld_set_inn",
      "max": 9999999,
      "min": 1,
      "name": "invoice_next_number",
      "onlyInt": true,
      "presentable": false,
      "required": false,
      "system": false,
      "type": "number"
    }))

    return app.save(collection)
  } catch (_) {
    // collection doesn't exist or fields already present — skip
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("yieldsetts01")

  // remove field
  collection.fields.removeById("fld_set_inf")

  // remove field
  collection.fields.removeById("fld_set_inn")

  return app.save(collection)
})
