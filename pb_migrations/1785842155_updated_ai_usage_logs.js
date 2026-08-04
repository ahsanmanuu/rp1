/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  let collection;
  try {
    collection = app.findCollectionByNameOrId("pbc_3543645026")
  } catch {
    return; // collection doesn't exist yet, skip
  }

  // update collection data
  unmarshal({
    "createRule": "",
    "listRule": "",
    "viewRule": ""
  }, collection)

  return app.save(collection)
}, (app) => {
  let collection;
  try {
    collection = app.findCollectionByNameOrId("pbc_3543645026")
  } catch {
    return; // collection doesn't exist in this environment, nothing to rollback
  }

  // update collection data
  unmarshal({
    "createRule": null,
    "listRule": null,
    "viewRule": null
  }, collection)

  return app.save(collection)
})
