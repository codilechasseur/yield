/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    // Add default_hourly_rate to settings
    const settings = app.findCollectionByNameOrId("yieldsetts01")
    settings.fields.addAt(settings.fields.length - 2, new Field({
      "hidden": false,
      "id": "fld_set_dhr",
      "max": null,
      "min": 0,
      "name": "default_hourly_rate",
      "onlyInt": false,
      "presentable": false,
      "required": false,
      "system": false,
      "type": "number"
    }))
    app.save(settings)
  } catch (_) {
    // collection doesn't exist or field already present — skip
  }

  try {
    // Add default_hourly_rate to clients
    const clients = app.findCollectionByNameOrId("_pb_clients_")
    clients.fields.addAt(clients.fields.length - 2, new Field({
      "hidden": false,
      "id": "fld_cli_dhr",
      "max": null,
      "min": 0,
      "name": "default_hourly_rate",
      "onlyInt": false,
      "presentable": false,
      "required": false,
      "system": false,
      "type": "number"
    }))
    return app.save(clients)
  } catch (_) {
    // collection doesn't exist or field already present — skip
  }
}, (app) => {
  const settings = app.findCollectionByNameOrId("yieldsetts01")
  settings.fields.removeById("fld_set_dhr")
  app.save(settings)

  const clients = app.findCollectionByNameOrId("_pb_clients_")
  clients.fields.removeById("fld_cli_dhr")
  return app.save(clients)
})
