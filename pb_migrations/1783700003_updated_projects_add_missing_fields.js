/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_484305853")

  // add templateName field
  collection.fields.addAt(6, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text3700003001",
    "max": 0,
    "min": 0,
    "name": "templateName",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add bibContent field
  collection.fields.addAt(7, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text3700003002",
    "max": 0,
    "min": 0,
    "name": "bibContent",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add originalFilename field
  collection.fields.addAt(8, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text3700003003",
    "max": 0,
    "min": 0,
    "name": "originalFilename",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add firstPdfDownloaded field
  collection.fields.addAt(9, new Field({
    "hidden": false,
    "id": "bool3700003004",
    "name": "firstPdfDownloaded",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_484305853")

  collection.fields.removeById("text3700003001")
  collection.fields.removeById("text3700003002")
  collection.fields.removeById("text3700003003")
  collection.fields.removeById("bool3700003004")

  return app.save(collection)
})
