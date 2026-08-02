/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    // Add smtp_bcc to settings — optional BCC address copied on all outgoing
    // invoice/estimate/reminder emails so the owner can verify delivery.
    const settings = app.findCollectionByNameOrId("yieldsetts01")
    if (settings.fields.find((f) => f.name === "smtp_bcc")) return
    settings.fields.addAt(settings.fields.length - 2, new Field({
      "hidden": false,
      "id": "fld_set_sbcc",
      "max": 0,
      "min": 0,
      "name": "smtp_bcc",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    }))
    return app.save(settings)
  } catch (_) {
    // collection doesn't exist or field already present — skip
  }
}, (app) => {
  const settings = app.findCollectionByNameOrId("yieldsetts01")
  settings.fields.removeById("fld_set_sbcc")
  return app.save(settings)
})
