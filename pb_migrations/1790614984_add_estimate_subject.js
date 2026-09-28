/// <reference path="../pb_data/types.d.ts" />
// Optional one-line subject on estimates, mirroring invoices.subject. Shown in
// estimate lists and on the PDF, and copied to the invoice on conversion.
migrate((app) => {
  try {
    const estimates = app.findCollectionByNameOrId("_pb_estimates_")
    if (estimates.fields.find((f) => f.name === "subject")) return
    estimates.fields.addAt(estimates.fields.length - 2, new Field({
      "hidden": false,
      "id": "fld_est_sub",
      "max": 200,
      "min": 0,
      "name": "subject",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    }))
    return app.save(estimates)
  } catch (_) {
    // collection doesn't exist or field already present — skip
  }
}, (app) => {
  const estimates = app.findCollectionByNameOrId("_pb_estimates_")
  estimates.fields.removeById("fld_est_sub")
  return app.save(estimates)
})
