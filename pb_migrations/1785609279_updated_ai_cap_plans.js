/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  let collection;
  try {
    collection = app.findCollectionByNameOrId("pbc_1734791159");
  } catch (_) {
    try {
      collection = app.findCollectionByNameOrId("ai_cap_plans");
    } catch (_) {
      return;
    }
  }
  if (!collection) return;

  // add field
  collection.fields.addAt(9, new Field({
    "hidden": false,
    "id": "number3686809561",
    "max": null,
    "min": null,
    "name": "priceINR",
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
    collection = app.findCollectionByNameOrId("pbc_1734791159");
  } catch (_) {
    try {
      collection = app.findCollectionByNameOrId("ai_cap_plans");
    } catch (_) {
      return;
    }
  }
  if (!collection) return;

  // remove field
  collection.fields.removeById("number3686809561")

  return app.save(collection)
})
