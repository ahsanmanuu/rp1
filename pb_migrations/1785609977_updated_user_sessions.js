/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2480489570")

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
  const collection = app.findCollectionByNameOrId("pbc_2480489570")

  // remove field
  collection.fields.removeById("date2455564630")

  return app.save(collection)
})
