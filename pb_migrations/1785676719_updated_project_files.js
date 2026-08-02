/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_4233393334")

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
  const collection = app.findCollectionByNameOrId("pbc_4233393334")

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
