/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_4233393334")

  // add filePath field - stores relative URL path for file access
  collection.fields.addAt(9, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text3501618721",
    "max": 0,
    "min": 0,
    "name": "filePath",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_4233393334")

  // remove filePath field
  collection.fields.removeById("text3501618721")

  return app.save(collection)
})
