/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    // Add smtp_reply_to to settings
    const settings = app.findCollectionByNameOrId("yieldsetts01")
    settings.fields.addAt(settings.fields.length - 2, new Field({
      "hidden": false,
      "id": "fld_set_srt",
      "max": 0,
      "min": 0,
      "name": "smtp_reply_to",
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
  settings.fields.removeById("fld_set_srt")
  return app.save(settings)
})
