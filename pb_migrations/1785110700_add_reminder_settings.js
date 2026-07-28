/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    // Add reminders_enabled + reminder_days to settings
    const settings = app.findCollectionByNameOrId("yieldsetts01")
    settings.fields.addAt(settings.fields.length - 2, new Field({
      "hidden": false,
      "id": "fld_set_rme",
      "name": "reminders_enabled",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "bool"
    }))
    settings.fields.addAt(settings.fields.length - 2, new Field({
      "hidden": false,
      "id": "fld_set_rmd",
      "max": null,
      "min": 1,
      "name": "reminder_days",
      "onlyInt": true,
      "presentable": false,
      "required": false,
      "system": false,
      "type": "number"
    }))
    return app.save(settings)
  } catch (_) {
    // collection doesn't exist or fields already present — skip
  }
}, (app) => {
  const settings = app.findCollectionByNameOrId("yieldsetts01")
  settings.fields.removeById("fld_set_rme")
  settings.fields.removeById("fld_set_rmd")
  return app.save(settings)
})
