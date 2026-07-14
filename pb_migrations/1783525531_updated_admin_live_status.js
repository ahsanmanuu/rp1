/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_411075280")

  // add field
  collection.fields.addAt(1, new Field({
    "hidden": false,
    "id": "bool4063377827",
    "name": "isLive",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(2, new Field({
    "hidden": false,
    "id": "date1925370682",
    "max": "",
    "min": "",
    "name": "lastSeenAt",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "date"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_411075280")

  // remove field
  collection.fields.removeById("bool4063377827")

  // remove field
  collection.fields.removeById("date1925370682")

  return app.save(collection)
})
