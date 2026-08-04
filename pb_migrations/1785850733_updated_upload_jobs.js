/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  let collection;
  try {
    collection = app.findCollectionByNameOrId("pbc_3706112456")
  } catch {
    return; // collection doesn't exist yet, skip
  }

  // update field
  collection.fields.addAt(7, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text114010235",
    "max": 100000000,
    "min": 0,
    "name": "rawBytes",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  let collection;
  try {
    collection = app.findCollectionByNameOrId("pbc_3706112456")
  } catch {
    return; // collection doesn't exist in this environment, nothing to rollback
  }

  // update field
  collection.fields.addAt(7, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text114010235",
    "max": 0,
    "min": 0,
    "name": "rawBytes",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
})
