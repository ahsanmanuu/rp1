/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  let collection;
  try {
    collection = app.findCollectionByNameOrId("pbc_2162197663")
  } catch (_) {
    return; // collection doesn't exist yet — skip
  }
  if (!collection) return;

  // add field
  collection.fields.addAt(9, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text2063623452",
    "max": 0,
    "min": 0,
    "name": "status",
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
    collection = app.findCollectionByNameOrId("pbc_2162197663")
  } catch (_) {
    return; // collection doesn't exist — skip rollback
  }
  if (!collection) return;

  // remove field
  collection.fields.removeById("text2063623452")

  return app.save(collection)
})
