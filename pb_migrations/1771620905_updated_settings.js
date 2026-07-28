/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const collection = app.findCollectionByNameOrId("yieldsetts01")

    // add field
    collection.fields.addAt(15, new Field({
      "hidden": false,
      "id": "number3926047535",
      "max": 100,
      "min": 0,
      "name": "income_tax_rate",
      "onlyInt": false,
      "presentable": false,
      "required": false,
      "system": false,
      "type": "number"
    }))

    // add field
    collection.fields.addAt(16, new Field({
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text1863497841",
      "max": 0,
      "min": 0,
      "name": "default_currency",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    }))

    return app.save(collection)
  } catch (_) {
    // collection doesn't exist or fields already present — skip
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("yieldsetts01")

  // remove field
  collection.fields.removeById("number3926047535")

  // remove field
  collection.fields.removeById("text1863497841")

  return app.save(collection)
})
