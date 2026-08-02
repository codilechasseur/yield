/// <reference path="../pb_data/types.d.ts" />
// White-labeling: optional overrides for the app name shown in the UI / page
// titles, and a custom favicon. Both empty = default Yield branding.
migrate((app) => {
  try {
    const collection = app.findCollectionByNameOrId("yieldsetts01")

    if (!collection.fields.find((f) => f.name === "app_name")) {
      collection.fields.addAt(collection.fields.length - 2, new Field({
        "hidden": false,
        "id": "fld_set_appname",
        "max": 40,
        "min": 0,
        "name": "app_name",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      }))
    }

    if (!collection.fields.find((f) => f.name === "favicon")) {
      collection.fields.addAt(collection.fields.length - 2, new Field({
        "hidden": false,
        "id": "fld_set_favicon",
        "maxSelect": 1,
        "maxSize": 1048576,
        "mimeTypes": ["image/png", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon", "image/jpeg", "image/webp", "image/gif"],
        "name": "favicon",
        "presentable": false,
        "protected": false,
        "required": false,
        "system": false,
        "thumbs": null,
        "type": "file"
      }))
    }

    return app.save(collection)
  } catch (_) {
    // collection doesn't exist or fields already present — skip
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("yieldsetts01")
  for (const id of ["fld_set_appname", "fld_set_favicon"]) {
    const f = collection.fields.find((f) => f.id === id)
    if (f) collection.fields.removeById(id)
  }
  return app.save(collection)
})
