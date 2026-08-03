/// <reference path="../pb_data/types.d.ts" />
// Brand theming: preset selection (code-defined token sets), UI font choice,
// an app-chrome logo upload (distinct from the invoice/PDF `logo`), and a
// custom-CSS escape hatch. All empty = default Yield branding.
migrate((app) => {
  try {
    const collection = app.findCollectionByNameOrId("yieldsetts01")

    if (!collection.fields.find((f) => f.name === "brand_preset")) {
      collection.fields.addAt(collection.fields.length - 2, new Field({
        "hidden": false,
        "id": "fld_set_brandpreset",
        "max": 40,
        "min": 0,
        "name": "brand_preset",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      }))
    }

    if (!collection.fields.find((f) => f.name === "brand_font")) {
      collection.fields.addAt(collection.fields.length - 2, new Field({
        "hidden": false,
        "id": "fld_set_brandfont",
        "max": 40,
        "min": 0,
        "name": "brand_font",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      }))
    }

    if (!collection.fields.find((f) => f.name === "app_logo")) {
      collection.fields.addAt(collection.fields.length - 2, new Field({
        "hidden": false,
        "id": "fld_set_applogo",
        "maxSelect": 1,
        "maxSize": 1048576,
        "mimeTypes": ["image/png", "image/svg+xml", "image/jpeg", "image/webp", "image/gif"],
        "name": "app_logo",
        "presentable": false,
        "protected": false,
        "required": false,
        "system": false,
        "thumbs": null,
        "type": "file"
      }))
    }

    if (!collection.fields.find((f) => f.name === "brand_custom_css")) {
      collection.fields.addAt(collection.fields.length - 2, new Field({
        "hidden": false,
        "id": "fld_set_customcss",
        "max": 20000,
        "min": 0,
        "name": "brand_custom_css",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      }))
    }

    return app.save(collection)
  } catch (_) {
    // collection doesn't exist or fields already present — skip
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("yieldsetts01")
  for (const id of ["fld_set_brandpreset", "fld_set_brandfont", "fld_set_applogo", "fld_set_customcss"]) {
    const f = collection.fields.find((f) => f.id === id)
    if (f) collection.fields.removeById(id)
  }
  return app.save(collection)
})
