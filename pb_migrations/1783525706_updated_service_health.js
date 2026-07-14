/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3623244722")

  // add field
  collection.fields.addAt(1, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text968917407",
    "max": 0,
    "min": 0,
    "name": "serviceKey",
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
    "id": "text1579384326",
    "max": 0,
    "min": 0,
    "name": "name",
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
    "id": "select2063623452",
    "maxSelect": 0,
    "name": "status",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "select",
    "values": [
      "stable",
      "normal",
      "high_load",
      "degraded",
      "down"
    ]
  }))

  // add field
  collection.fields.addAt(4, new Field({
    "hidden": false,
    "id": "number1563400775",
    "max": null,
    "min": null,
    "name": "uptime",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(5, new Field({
    "hidden": false,
    "id": "number3630923578",
    "max": null,
    "min": null,
    "name": "latencyMs",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(6, new Field({
    "hidden": false,
    "id": "number523716134",
    "max": null,
    "min": null,
    "name": "queueJobs",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(7, new Field({
    "hidden": false,
    "id": "number230117214",
    "max": null,
    "min": null,
    "name": "usagePercent",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(8, new Field({
    "hidden": false,
    "id": "date3082795393",
    "max": "",
    "min": "",
    "name": "manualOverrideAt",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "date"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3623244722")

  // remove field
  collection.fields.removeById("text968917407")

  // remove field
  collection.fields.removeById("text1579384326")

  // remove field
  collection.fields.removeById("select2063623452")

  // remove field
  collection.fields.removeById("number1563400775")

  // remove field
  collection.fields.removeById("number3630923578")

  // remove field
  collection.fields.removeById("number523716134")

  // remove field
  collection.fields.removeById("number230117214")

  // remove field
  collection.fields.removeById("date3082795393")

  return app.save(collection)
})
