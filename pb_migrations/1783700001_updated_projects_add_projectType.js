/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_484305853")

  // add projectType field
  collection.fields.addAt(4, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1689669069",
    "max": 0,
    "min": 0,
    "name": "projectType",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add latexContent field
  collection.fields.addAt(5, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1689669070",
    "max": 0,
    "min": 0,
    "name": "latexContent",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add content field
  collection.fields.addAt(6, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1689669071",
    "max": 0,
    "min": 0,
    "name": "content",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // set listRule to allow authenticated users to read their own projects
  collection.listRule = "@request.auth.id != '' && userId = @request.auth.id"
  collection.viewRule = "@request.auth.id != '' && userId = @request.auth.id"
  collection.createRule = "@request.auth.id != ''"
  collection.updateRule = "@request.auth.id != '' && userId = @request.auth.id"
  collection.deleteRule = "@request.auth.id != '' && userId = @request.auth.id"

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_484305853")

  collection.fields.removeById("text1689669069")
  collection.fields.removeById("text1689669070")
  collection.fields.removeById("text1689669071")

  collection.listRule = null
  collection.viewRule = null
  collection.createRule = null
  collection.updateRule = null
  collection.deleteRule = null

  return app.save(collection)
})
