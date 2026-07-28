/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    // Add harvest_account_id + harvest_token to settings
    const settings = app.findCollectionByNameOrId("yieldsetts01")
    settings.fields.addAt(settings.fields.length - 2, new Field({
      "hidden": false,
      "id": "fld_set_hai",
      "max": 0,
      "min": 0,
      "name": "harvest_account_id",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    }))
    settings.fields.addAt(settings.fields.length - 2, new Field({
      "hidden": false,
      "id": "fld_set_htk",
      "max": 0,
      "min": 0,
      "name": "harvest_token",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    }))
    return app.save(settings)
  } catch (_) {
    // collection doesn't exist or fields already present — skip
  }
}, (app) => {
  const settings = app.findCollectionByNameOrId("yieldsetts01")
  settings.fields.removeById("fld_set_hai")
  settings.fields.removeById("fld_set_htk")
  return app.save(settings)
})
