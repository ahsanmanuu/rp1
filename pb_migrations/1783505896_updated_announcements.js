/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3866499052")

  // add field
  collection.fields.addAt(1, new Field({
    "hidden": false,
    "id": "autodate3042627355",
    "name": "t3",
    "onCreate": true,
    "onUpdate": false,
    "presentable": false,
    "system": false,
    "type": "autodate"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3866499052")

  // remove field
  collection.fields.removeById("autodate3042627355")

  return app.save(collection)
})
