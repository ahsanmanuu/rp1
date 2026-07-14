/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3684421146")

  // remove field
  collection.fields.removeById("text1707687987")

  // remove field
  collection.fields.removeById("text283152957")

  // remove field
  collection.fields.removeById("number45300170")

  // remove field
  collection.fields.removeById("number236923548")

  // remove field
  collection.fields.removeById("number1900214037")

  // remove field
  collection.fields.removeById("autodate2261412156")

  // remove field
  collection.fields.removeById("autodate3175243278")

  // add field
  collection.fields.addAt(4, new Field({
    "hidden": false,
    "id": "select1707687987",
    "maxSelect": 0,
    "name": "matchType",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "select",
    "values": [
      "email_exact",
      "email_domain",
      "email_regex",
      "ip_exact",
      "ip_cidr",
      "location_country",
      "location_city"
    ]
  }))

  // add field
  collection.fields.addAt(6, new Field({
    "hidden": false,
    "id": "select283152957",
    "maxSelect": 0,
    "name": "capType",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "select",
    "values": [
      "daily_tokens",
      "daily_requests",
      "block"
    ]
  }))

  // add field
  collection.fields.addAt(7, new Field({
    "hidden": false,
    "id": "number120697484",
    "max": null,
    "min": null,
    "name": "capValue",
    "onlyInt": false,
    "presentable": false,
    "required": true,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(8, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text3422461647",
    "max": 0,
    "min": 0,
    "name": "agentFilter",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(11, new Field({
    "hidden": false,
    "id": "number1787543293",
    "max": null,
    "min": null,
    "name": "hitCount",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(12, new Field({
    "hidden": false,
    "id": "date3463701430",
    "max": "",
    "min": "",
    "name": "lastHitAt",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "date"
  }))

  // update field
  collection.fields.addAt(9, new Field({
    "hidden": false,
    "id": "number1655102503",
    "max": null,
    "min": null,
    "name": "priority",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3684421146")

  // add field
  collection.fields.addAt(4, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1707687987",
    "max": 0,
    "min": 0,
    "name": "matchType",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(6, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text283152957",
    "max": 0,
    "min": 0,
    "name": "capType",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(7, new Field({
    "hidden": false,
    "id": "number45300170",
    "max": null,
    "min": null,
    "name": "dailyTokenLimit",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(8, new Field({
    "hidden": false,
    "id": "number236923548",
    "max": null,
    "min": null,
    "name": "dailyRequestLimit",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(9, new Field({
    "hidden": false,
    "id": "number1900214037",
    "max": null,
    "min": null,
    "name": "blockDuration",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(12, new Field({
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
  collection.fields.addAt(13, new Field({
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
  collection.fields.removeById("select1707687987")

  // remove field
  collection.fields.removeById("select283152957")

  // remove field
  collection.fields.removeById("number120697484")

  // remove field
  collection.fields.removeById("text3422461647")

  // remove field
  collection.fields.removeById("number1787543293")

  // remove field
  collection.fields.removeById("date3463701430")

  // update field
  collection.fields.addAt(10, new Field({
    "hidden": false,
    "id": "number1655102503",
    "max": null,
    "min": null,
    "name": "priority",
    "onlyInt": false,
    "presentable": false,
    "required": true,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
})
