migrate((app) => {
  // Add memberSince field to users collection
  const users = app.dao().findCollectionByNameOrId('users');
  if (!users.schema.findFieldByPath('memberSince')) {
    const field = new Field({
      name: 'memberSince',
      type: 'date',
      required: false,
    });
    users.schema.addField(field);
    app.dao().saveCollection(users);
  }

  // Create user_membership_logs collection
  const logs = new Collection({
    name: 'user_membership_logs',
    type: 'base',
    system: false,
    schema: [
      { name: 'userId', type: 'text', required: true },
      { name: 'fromPlan', type: 'text', required: true },
      { name: 'toPlan', type: 'text', required: true },
      { name: 'eventType', type: 'text', required: true },
      { name: 'source', type: 'text', required: true },
      { name: 'metadata', type: 'text', required: false },
    ],
    indexes: [
      { unique: false, columns: ['userId'] },
      { unique: false, columns: ['eventType'] },
      { unique: false, columns: ['created'] },
    ],
    listRule: '@request.auth.id != "" && userId = @request.auth.id',
    viewRule: '@request.auth.id != "" && userId = @request.auth.id',
    createRule: '@request.auth.id != ""',
    updateRule: null,
    deleteRule: null,
  });
  app.dao().saveCollection(logs);
}, (app) => {
  const users = app.dao().findCollectionByNameOrId('users');
  const field = users.schema.findFieldByPath('memberSince');
  if (field) {
    users.schema.removeField(field.id);
    app.dao().saveCollection(users);
  }
  try {
    app.dao().deleteCollection('user_membership_logs');
  } catch (_) {}
});
