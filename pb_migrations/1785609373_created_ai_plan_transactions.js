/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const existing = app.findCollectionByNameOrId("ai_plan_transactions");
    if (existing) return; // already created
  } catch (_) {}

  let usersCollectionId = "_pb_users_auth_";
  try {
    const uCol = app.findCollectionByNameOrId("users") || app.findCollectionByNameOrId("_pb_users_auth_");
    if (uCol) usersCollectionId = uCol.id;
  } catch (_) {}

  let plansCollectionId = null;
  try {
    const pCol = app.findCollectionByNameOrId("ai_cap_plans") || app.findCollectionByNameOrId("pbc_1734791159");
    if (pCol) plansCollectionId = pCol.id;
  } catch (_) {}

  const fields = [
    {
      "autogeneratePattern": "[a-z0-9]{15}",
      "hidden": false,
      "id": "text3208210256",
      "max": 15,
      "min": 15,
      "name": "id",
      "pattern": "^[a-z0-9]+$",
      "presentable": false,
      "primaryKey": true,
      "required": true,
      "system": true,
      "type": "text"
    },
    {
      "cascadeDelete": false,
      "collectionId": usersCollectionId,
      "hidden": false,
      "id": "relation1689669068",
      "maxSelect": 1,
      "minSelect": 0,
      "name": "userId",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "relation"
    },
    {
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text4196627511",
      "max": 0,
      "min": 0,
      "name": "orderId",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    }
  ];

  if (plansCollectionId) {
    fields.push({
      "cascadeDelete": false,
      "collectionId": plansCollectionId,
      "hidden": false,
      "id": "relation1284837743",
      "maxSelect": 1,
      "minSelect": 0,
      "name": "planId",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "relation"
    });
  } else {
    fields.push({
      "autogeneratePattern": "",
      "hidden": false,
      "id": "relation1284837743",
      "max": 0,
      "min": 0,
      "name": "planId",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    });
  }

  fields.push(
    {
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text3214635935",
      "max": 0,
      "min": 0,
      "name": "planName",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    },
    {
      "hidden": false,
      "id": "number2392944706",
      "max": null,
      "min": null,
      "name": "amount",
      "onlyInt": false,
      "presentable": false,
      "required": false,
      "system": false,
      "type": "number"
    },
    {
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text1767278655",
      "max": 0,
      "min": 0,
      "name": "currency",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    },
    {
      "hidden": false,
      "id": "number597102584",
      "max": null,
      "min": null,
      "name": "durationMonths",
      "onlyInt": false,
      "presentable": false,
      "required": false,
      "system": false,
      "type": "number"
    },
    {
      "hidden": false,
      "id": "select2715662852",
      "maxSelect": 1,
      "name": "paymentStatus",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "select",
      "values": [
        "pending",
        "paid",
        "failed"
      ]
    },
    {
      "hidden": false,
      "id": "date327219409",
      "max": "",
      "min": "",
      "name": "startsAt",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "date"
    },
    {
      "hidden": false,
      "id": "date730627375",
      "max": "",
      "min": "",
      "name": "expiresAt",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "date"
    }
  );

  const collection = new Collection({
    "createRule": null,
    "deleteRule": null,
    "fields": fields,
    "id": "pbc_1725360838",
    "name": "ai_plan_transactions",
    "system": false,
    "type": "base"
  });

  try {
    return app.save(collection);
  } catch (_) {
    return;
  }
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("pbc_1725360838") || app.findCollectionByNameOrId("ai_plan_transactions");
    if (collection) return app.delete(collection);
  } catch (_) {}
})
