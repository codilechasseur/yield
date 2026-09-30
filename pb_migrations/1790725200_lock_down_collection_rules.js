/// <reference path="../pb_data/types.d.ts" />
// Lock every app collection to superusers only. Yield talks to PocketBase as
// the superuser (PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD, see src/lib/pb.server.ts),
// so public API rules only let anyone who can reach PocketBase directly read
// and rewrite everything — including the app password hash and SMTP password.
// pb_schema.json carries the same null rules so the boot-time schema import
// doesn't reopen them.
migrate((app) => {
  for (const col of app.findAllCollections()) {
    if (col.system) continue
    col.listRule = null
    col.viewRule = null
    col.createRule = null
    col.updateRule = null
    col.deleteRule = null
    app.save(col)
  }
}, (app) => {
  // Reopen the app's collections (the pre-lockdown state).
  const names = [
    "clients", "contacts", "invoices", "invoice_items", "invoice_logs", "settings",
    "tax_payments", "expenses", "estimates", "estimate_items", "estimate_logs"
  ]
  for (const name of names) {
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
})
