/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_58134070")

  // add field
  collection.fields.addAt(1, new Field({
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
  collection.fields.addAt(2, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text2632504646",
    "max": 0,
    "min": 0,
    "name": "publisher",
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
    "id": "select2902042787",
    "maxSelect": 0,
    "name": "quartile",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "select",
    "values": [
      "Q1",
      "Q2",
      "Q3",
      "Q4"
    ]
  }))

  // add field
  collection.fields.addAt(4, new Field({
    "hidden": false,
    "id": "select29867064",
    "maxSelect": 0,
    "name": "accessType",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "select",
    "values": [
      "Open Access",
      "Subscription",
      "Hybrid"
    ]
  }))

  // add field
  collection.fields.addAt(5, new Field({
    "hidden": false,
    "id": "number1305489681",
    "max": null,
    "min": null,
    "name": "apc",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(6, new Field({
    "hidden": false,
    "id": "number4113186883",
    "max": null,
    "min": null,
    "name": "impactFactor",
    "onlyInt": false,
    "presentable": false,
    "required": true,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(7, new Field({
    "hidden": false,
    "id": "json1922903102",
    "maxSize": 0,
    "name": "indexing",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  // add field
  collection.fields.addAt(8, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1041977128",
    "max": 0,
    "min": 0,
    "name": "reviewTimeWeeks",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(9, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text842937202",
    "max": 0,
    "min": 0,
    "name": "publicationTimeWeeks",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(10, new Field({
    "exceptDomains": null,
    "hidden": false,
    "id": "url167763701",
    "name": "latexTemplateUrl",
    "onlyDomains": null,
    "presentable": false,
    "required": true,
    "system": false,
    "type": "url"
  }))

  // add field
  collection.fields.addAt(11, new Field({
    "exceptDomains": null,
    "hidden": false,
    "id": "url2193034978",
    "name": "homeUrl",
    "onlyDomains": null,
    "presentable": false,
    "required": true,
    "system": false,
    "type": "url"
  }))

  // add field
  collection.fields.addAt(12, new Field({
    "hidden": false,
    "id": "json2356920221",
    "maxSize": 0,
    "name": "domains",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  // add field
  collection.fields.addAt(13, new Field({
    "hidden": false,
    "id": "number464197939",
    "max": null,
    "min": null,
    "name": "sjrScore",
    "onlyInt": false,
    "presentable": false,
    "required": true,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(14, new Field({
    "hidden": false,
    "id": "json2858399070",
    "maxSize": 0,
    "name": "keywords",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  // add field
  collection.fields.addAt(15, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text3970978547",
    "max": 0,
    "min": 0,
    "name": "scopeText",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(16, new Field({
    "hidden": false,
    "id": "number3912975203",
    "max": null,
    "min": null,
    "name": "minRecommendedScore",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(17, new Field({
    "hidden": false,
    "id": "json614367109",
    "maxSize": 0,
    "name": "methodologyFocus",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_58134070")

  // remove field
  collection.fields.removeById("text1579384326")

  // remove field
  collection.fields.removeById("text2632504646")

  // remove field
  collection.fields.removeById("select2902042787")

  // remove field
  collection.fields.removeById("select29867064")

  // remove field
  collection.fields.removeById("number1305489681")

  // remove field
  collection.fields.removeById("number4113186883")

  // remove field
  collection.fields.removeById("json1922903102")

  // remove field
  collection.fields.removeById("text1041977128")

  // remove field
  collection.fields.removeById("text842937202")

  // remove field
  collection.fields.removeById("url167763701")

  // remove field
  collection.fields.removeById("url2193034978")

  // remove field
  collection.fields.removeById("json2356920221")

  // remove field
  collection.fields.removeById("number464197939")

  // remove field
  collection.fields.removeById("json2858399070")

  // remove field
  collection.fields.removeById("text3970978547")

  // remove field
  collection.fields.removeById("number3912975203")

  // remove field
  collection.fields.removeById("json614367109")

  return app.save(collection)
})
