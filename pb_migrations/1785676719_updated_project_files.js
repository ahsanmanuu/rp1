/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  let collection;
  try {
    collection = app.findCollectionByNameOrId("pbc_4233393334");
  } catch (_) {
    try {
      collection = app.findCollectionByNameOrId("project_files");
    } catch (_) {
      return;
    }
  }
  if (!collection) return;

  // update field
  collection.fields.addAt(8, new Field({
    "convertURLs": false,
    "hidden": false,
    "id": "editor4274335913",
    "maxSize": 20971520,
    "name": "content",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "editor"
  }))

  return app.save(collection)
}, (app) => {
  let collection;
  try {
    collection = app.findCollectionByNameOrId("pbc_4233393334");
  } catch (_) {
    try {
      collection = app.findCollectionByNameOrId("project_files");
    } catch (_) {
      return;
    }
  }
  if (!collection) return;

  // update field
  collection.fields.addAt(8, new Field({
    "convertURLs": false,
    "hidden": false,
    "id": "editor4274335913",
    "maxSize": 0,
    "name": "content",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "editor"
  }))

  return app.save(collection)
})
