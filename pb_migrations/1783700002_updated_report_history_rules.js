/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1623750876")

  // set rules for authenticated users
  collection.listRule = "@request.auth.id != '' && userId = @request.auth.id"
  collection.viewRule = "@request.auth.id != '' && userId = @request.auth.id"
  collection.createRule = "@request.auth.id != ''"
  collection.updateRule = "@request.auth.id != '' && userId = @request.auth.id"
  collection.deleteRule = "@request.auth.id != '' && userId = @request.auth.id"

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1623750876")

  collection.listRule = null
  collection.viewRule = null
  collection.createRule = null
  collection.updateRule = null
  collection.deleteRule = null

  return app.save(collection)
})
