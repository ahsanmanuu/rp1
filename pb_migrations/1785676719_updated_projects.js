/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  let collection;
  try {
    collection = app.findCollectionByNameOrId("pbc_484305853");
  } catch (_) {
    try {
      collection = app.findCollectionByNameOrId("projects");
    } catch (_) {
      return;
    }
  }
  if (!collection) return;

  // update field
  collection.fields.addAt(7, new Field({
    "convertURLs": false,
    "hidden": false,
    "id": "editor4246737785",
    "maxSize": 20971520,
    "name": "latexContent",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "editor"
  }))

  // update field
  collection.fields.addAt(8, new Field({
    "convertURLs": false,
    "hidden": false,
    "id": "editor4169333321",
    "maxSize": 20971520,
    "name": "bibContent",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "editor"
  }))

  // update field
  collection.fields.addAt(20, new Field({
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

  // update field
  collection.fields.addAt(21, new Field({
    "hidden": false,
    "id": "json847066671",
    "maxSize": 20971520,
    "name": "structuredContent",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  return app.save(collection)
}, (app) => {
  let collection;
  try {
    collection = app.findCollectionByNameOrId("pbc_484305853");
  } catch (_) {
    try {
      collection = app.findCollectionByNameOrId("projects");
    } catch (_) {
      return;
    }
  }
  if (!collection) return;

  // update field
  collection.fields.addAt(7, new Field({
    "convertURLs": false,
    "hidden": false,
    "id": "editor4246737785",
    "maxSize": 0,
    "name": "latexContent",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "editor"
  }))

  // update field
  collection.fields.addAt(8, new Field({
    "convertURLs": false,
    "hidden": false,
    "id": "editor4169333321",
    "maxSize": 0,
    "name": "bibContent",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "editor"
  }))

  // update field
  collection.fields.addAt(20, new Field({
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

  // update field
  collection.fields.addAt(21, new Field({
    "hidden": false,
    "id": "json847066671",
    "maxSize": 0,
    "name": "structuredContent",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  return app.save(collection)
})
