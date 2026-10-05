/// <reference path="../pb_data/types.d.ts" />
// Sales-tax registration number (e.g. a GST/HST number), printed in the PDF
// header under the company address on every invoice and estimate.
migrate((app) => {
  try {
    const collection = app.findCollectionByNameOrId("yieldsetts01")
    if (collection.fields.find((f) => f.name === "tax_number")) return
    collection.fields.addAt(collection.fields.length - 2, new Field({
      "hidden": false,
      "id": "fld_set_taxnum",
      "max": 60,
      "min": 0,
      "name": "tax_number",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    }))
    return app.save(collection)
  } catch (_) {
    // collection doesn't exist or field already present — skip
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("yieldsetts01")
  collection.fields.removeById("fld_set_taxnum")
  return app.save(collection)
})
