/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const collection = app.findCollectionByNameOrId("yieldsetts01")

    // add field
    collection.fields.addAt(23, new Field({
      "hidden": false,
      "id": "fld_set_log",
      "maxSelect": 1,
      "maxSize": 5242880,
      "mimeTypes": ["image/jpeg", "image/png", "image/gif", "image/svg+xml", "image/webp"],
      "name": "logo",
      "presentable": false,
      "protected": false,
      "required": false,
      "system": false,
      "thumbs": null,
      "type": "file"
    }))

    return app.save(collection)
  } catch (_) {
    // collection doesn't exist or field already present — skip
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("yieldsetts01")

  // remove field
  collection.fields.removeById("fld_set_log")

  return app.save(collection)
})
