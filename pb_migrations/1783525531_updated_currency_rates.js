/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_886955213")

  // add field
  collection.fields.addAt(1, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1647765691",
    "max": 0,
    "min": 0,
    "name": "fromCurrency",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(2, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1794127585",
    "max": 0,
    "min": 0,
    "name": "toCurrency",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(3, new Field({
    "hidden": false,
    "id": "number3756801849",
    "max": null,
    "min": null,
    "name": "rate",
    "onlyInt": false,
    "presentable": false,
    "required": true,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(4, new Field({
    "hidden": false,
    "id": "date3175243278",
    "max": "",
    "min": "",
    "name": "updatedAt",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "date"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_886955213")

  // remove field
  collection.fields.removeById("text1647765691")

  // remove field
  collection.fields.removeById("text1794127585")

  // remove field
  collection.fields.removeById("number3756801849")

  // remove field
  collection.fields.removeById("date3175243278")

  return app.save(collection)
})
