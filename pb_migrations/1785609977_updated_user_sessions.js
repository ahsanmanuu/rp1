/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  let collection;
  try {
    collection = app.findCollectionByNameOrId("pbc_2480489570");
  } catch (_) {
    try {
      collection = app.findCollectionByNameOrId("user_sessions");
    } catch (_) {
      return;
    }
  }
  if (!collection) return;

  // add field
  collection.fields.addAt(10, new Field({
    "hidden": false,
    "id": "date2455564630",
    "max": "",
    "min": "",
    "name": "lastActiveAt",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "date"
  }))

  return app.save(collection)
}, (app) => {
  let collection;
  try {
    collection = app.findCollectionByNameOrId("pbc_2480489570");
  } catch (_) {
    try {
      collection = app.findCollectionByNameOrId("user_sessions");
    } catch (_) {
      return;
    }
  }
  if (!collection) return;

  // remove field
  collection.fields.removeById("date2455564630")

  return app.save(collection)
})
