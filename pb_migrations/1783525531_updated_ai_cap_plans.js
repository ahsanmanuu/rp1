/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1734791159")

  // remove field
  collection.fields.removeById("number3532077721")

  // remove field
  collection.fields.removeById("number1994947678")

  // remove field
  collection.fields.removeById("number1796423178")

  // remove field
  collection.fields.removeById("number2870690767")

  // remove field
  collection.fields.removeById("bool2241418015")

  // remove field
  collection.fields.removeById("number3402113753")

  // remove field
  collection.fields.removeById("number1063427325")

  // remove field
  collection.fields.removeById("autodate2261412156")

  // remove field
  collection.fields.removeById("autodate3175243278")

  // add field
  collection.fields.addAt(2, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text245846248",
    "max": 0,
    "min": 0,
    "name": "label",
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
    "id": "number3560878343",
    "max": null,
    "min": null,
    "name": "dailyTokenCap",
    "onlyInt": false,
    "presentable": false,
    "required": true,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(5, new Field({
    "hidden": false,
    "id": "bool2323052248",
    "name": "isActive",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1734791159")

  // add field
  collection.fields.addAt(3, new Field({
    "hidden": false,
    "id": "number3532077721",
    "max": null,
    "min": null,
    "name": "defaultDailyTokenLimit",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(4, new Field({
    "hidden": false,
    "id": "number1994947678",
    "max": null,
    "min": null,
    "name": "maxDailyTokenLimit",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(5, new Field({
    "hidden": false,
    "id": "number1796423178",
    "max": null,
    "min": null,
    "name": "maxDailyRequests",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(6, new Field({
    "hidden": false,
    "id": "number2870690767",
    "max": null,
    "min": null,
    "name": "maxAgents",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(7, new Field({
    "hidden": false,
    "id": "bool2241418015",
    "name": "isDefault",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(8, new Field({
    "hidden": false,
    "id": "number3402113753",
    "max": null,
    "min": null,
    "name": "price",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(9, new Field({
    "hidden": false,
    "id": "number1063427325",
    "max": null,
    "min": null,
    "name": "sortOrder",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(10, new Field({
    "hidden": false,
    "id": "autodate2261412156",
    "name": "createdAt",
    "onCreate": true,
    "onUpdate": false,
    "presentable": false,
    "system": false,
    "type": "autodate"
  }))

  // add field
  collection.fields.addAt(11, new Field({
    "hidden": false,
    "id": "autodate3175243278",
    "name": "updatedAt",
    "onCreate": false,
    "onUpdate": true,
    "presentable": false,
    "system": false,
    "type": "autodate"
  }))

  // remove field
  collection.fields.removeById("text245846248")

  // remove field
  collection.fields.removeById("number3560878343")

  // remove field
  collection.fields.removeById("bool2323052248")

  return app.save(collection)
})
