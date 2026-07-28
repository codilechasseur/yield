/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const contacts = app.findCollectionByNameOrId("contacts");
    const clients = app.findCollectionByNameOrId("clients");

    const clientField = contacts.fields.getByName("client");
    if (!clientField || clientField.collectionId === clients.id) {
      // Already correct — nothing to do
      return;
    }

    // Replace the field with the corrected collectionId so that
    // PocketBase can resolve the relation when creating contact records.
    contacts.fields.add(new Field({
      "cascadeDelete": true,
      "collectionId": clients.id,
      "hidden": false,
      "id": "fld_con_cli",
      "maxSelect": 1,
      "minSelect": 0,
      "name": "client",
      "presentable": false,
      "required": true,
      "system": false,
      "type": "relation"
    }));
    app.save(contacts);
  } catch (_) {
    // One or both collections don't exist — skip
  }
}, (app) => {
  // No meaningful rollback: we don't know what the old (broken) collectionId was
});
