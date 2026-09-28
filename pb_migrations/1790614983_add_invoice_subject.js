/// <reference path="../pb_data/types.d.ts" />
// Optional one-line subject on invoices (e.g. "Retainer for Acme — August 2026"),
// shown in invoice lists, on the PDF, and available to email templates as {subject}.
migrate((app) => {
  try {
    const invoices = app.findCollectionByNameOrId("_pb_invoices_")
    if (invoices.fields.find((f) => f.name === "subject")) return
    invoices.fields.addAt(invoices.fields.length - 2, new Field({
      "hidden": false,
      "id": "fld_inv_sub",
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
    return app.save(invoices)
  } catch (_) {
    // collection doesn't exist or field already present — skip
  }
}, (app) => {
  const invoices = app.findCollectionByNameOrId("_pb_invoices_")
  invoices.fields.removeById("fld_inv_sub")
  return app.save(invoices)
})
