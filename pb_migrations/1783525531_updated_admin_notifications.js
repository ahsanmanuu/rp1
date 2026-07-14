/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_4269230398")

  if (!collection.fields.hasFieldWithName("type")) {
    collection.fields.addAt(1, new Field({
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text1000000079",
      "max": 0,
      "min": 0,
      "name": "type",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": true,
      "system": false,
      "type": "text"
    }))
  }

  if (!collection.fields.hasFieldWithName("title")) {
    collection.fields.addAt(2, new Field({
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text1000000080",
      "max": 0,
      "min": 0,
      "name": "title",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": true,
      "system": false,
      "type": "text"
    }))
  }

  if (!collection.fields.hasFieldWithName("body")) {
    collection.fields.addAt(3, new Field({
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text1000000081",
      "max": 0,
      "min": 0,
      "name": "body",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": true,
      "system": false,
      "type": "text"
    }))
  }

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_4269230398")

  return app.save(collection)
})
