/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_4269230398");

  if (typeof collection.getFieldByName === "function") {
    if (!collection.getFieldByName("created")) {
      collection.fields.addAt(1, new Field({
        "hidden": false,
        "id": "autodate2990389176",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }))
    }

    if (!collection.getFieldByName("updated")) {
      collection.fields.addAt(2, new Field({
        "hidden": false,
        "id": "autodate3332085495",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }))
    }
  } else {
    // hasFieldWithName exists (older PB version)
    if (!collection.fields.hasFieldWithName("created")) {
      collection.fields.addAt(1, new Field({
        "hidden": false,
        "id": "autodate2990389176",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }))
    }

    if (!collection.fields.hasFieldWithName("updated")) {
      collection.fields.addAt(2, new Field({
        "hidden": false,
        "id": "autodate3332085495",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }))
    }
  }

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_4269230398");

  return app.save(collection)
})
