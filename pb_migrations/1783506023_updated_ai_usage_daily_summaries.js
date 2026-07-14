/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_445795538")

  // add field
  collection.fields.addAt(1, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text2862495610",
    "max": 0,
    "min": 0,
    "name": "date",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(2, new Field({
    "hidden": false,
    "id": "number3837554198",
    "max": null,
    "min": null,
    "name": "totalTokens",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(3, new Field({
    "hidden": false,
    "id": "number3696379156",
    "max": null,
    "min": null,
    "name": "promptTokens",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(4, new Field({
    "hidden": false,
    "id": "number2794999538",
    "max": null,
    "min": null,
    "name": "completionTokens",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(5, new Field({
    "hidden": false,
    "id": "number1721384071",
    "max": null,
    "min": null,
    "name": "requestCount",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(6, new Field({
    "hidden": false,
    "id": "json695616496",
    "maxSize": 0,
    "name": "agentBreakdown",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  // add field
  collection.fields.addAt(7, new Field({
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
  collection.fields.addAt(8, new Field({
    "hidden": false,
    "id": "autodate3175243278",
    "name": "updatedAt",
    "onCreate": false,
    "onUpdate": true,
    "presentable": false,
    "system": false,
    "type": "autodate"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_445795538")

  // remove field
  collection.fields.removeById("text2862495610")

  // remove field
  collection.fields.removeById("number3837554198")

  // remove field
  collection.fields.removeById("number3696379156")

  // remove field
  collection.fields.removeById("number2794999538")

  // remove field
  collection.fields.removeById("number1721384071")

  // remove field
  collection.fields.removeById("json695616496")

  // remove field
  collection.fields.removeById("autodate2261412156")

  // remove field
  collection.fields.removeById("autodate3175243278")

  return app.save(collection)
})
