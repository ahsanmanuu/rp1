/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1734791159")

  // remove field
  collection.fields.removeById("number1519677788")

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1734791159")

  // add field
  collection.fields.addAt(8, new Field({
    "hidden": false,
    "id": "number1519677788",
    "max": null,
    "min": null,
    "name": "priceINR_test",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
})
