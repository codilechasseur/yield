/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const collection = app.findCollectionByNameOrId("yieldsetts01")

    // add field
    collection.fields.addAt(24, new Field({
      "hidden": false,
      "id": "fld_set_lhc",
      "name": "logo_hide_company_name",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "bool"
    }))

    return app.save(collection)
  } catch (_) {
    // collection doesn't exist or field already present — skip
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("yieldsetts01")

  // remove field
  collection.fields.removeById("fld_set_lhc")

  return app.save(collection)
})
