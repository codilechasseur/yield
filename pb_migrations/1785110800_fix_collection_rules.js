/// <reference path="../pb_data/types.d.ts" />
// Collections created by earlier migrations were left with null API rules
// (superuser-only), but the app talks to PocketBase as an unauthenticated
// client — open them up to match the rest of the app's collections.
migrate((app) => {
  for (const name of ["estimates", "estimate_items", "estimate_logs", "expenses"]) {
    try {
      const col = app.findCollectionByNameOrId(name)
      col.listRule = ""
      col.viewRule = ""
      col.createRule = ""
      col.updateRule = ""
      col.deleteRule = ""
      app.save(col)
    } catch (_) {
      // collection doesn't exist on this instance — skip
    }
  }
}, (app) => {
  for (const name of ["estimates", "estimate_items", "estimate_logs", "expenses"]) {
    try {
      const col = app.findCollectionByNameOrId(name)
      col.listRule = null
      col.viewRule = null
      col.createRule = null
      col.updateRule = null
      col.deleteRule = null
      app.save(col)
    } catch (_) {}
  }
})
