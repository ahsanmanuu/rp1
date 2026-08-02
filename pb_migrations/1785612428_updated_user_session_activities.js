/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  let collection;
  try {
    collection = app.findCollectionByNameOrId("pbc_2825467173");
  } catch (_) {
    try {
      collection = app.findCollectionByNameOrId("user_session_activities");
    } catch (_) {
      return;
    }
  }
  if (!collection) return;

  // add field
  collection.fields.addAt(7, new Field({
    "hidden": false,
    "id": "number1092145443",
    "max": null,
    "min": null,
    "name": "latitude",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(8, new Field({
    "hidden": false,
    "id": "number2246143851",
    "max": null,
    "min": null,
    "name": "longitude",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  let collection;
  try {
    collection = app.findCollectionByNameOrId("pbc_2825467173");
  } catch (_) {
    try {
      collection = app.findCollectionByNameOrId("user_session_activities");
    } catch (_) {
      return;
    }
  }
  if (!collection) return;

  // remove field
  collection.fields.removeById("number1092145443")

  // remove field
  collection.fields.removeById("number2246143851")

  return app.save(collection)
})
