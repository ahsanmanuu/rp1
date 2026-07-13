import { prisma } from './prisma';
import { pbAdmin, createPb } from './pb';

const PB_USER_FIELDS = [
  'points', 'theme', 'status', 'role', 'membership',
  'membershipExpiresAt', 'blockedUntil', 'blacklistReason',
  'aiDailyCapOverride', 'aiAgentReactivatesAt',
] as const;

export async function syncUserToPb(userId: string, data: Record<string, any>): Promise<boolean> {
  try {
    const admPb = await pbAdmin();
    const pbUser = await admPb.collection('users').getOne(userId).catch(() => null);
    if (!pbUser) return false;

    const updateData: Record<string, any> = {};
    for (const field of PB_USER_FIELDS) {
      if (field in data) {
        const val = data[field];
        updateData[field] = val instanceof Date ? val.toISOString() : val;
      }
    }
    if (Object.keys(updateData).length === 0) return false;

    await admPb.collection('users').update(userId, updateData);
    return true;
  } catch {
    return false;
  }
}

export async function syncUserFromPb(userId: string): Promise<boolean> {
  try {
    const admPb = await pbAdmin();
    const pbUser = await admPb.collection('users').getOne(userId).catch(() => null);
    if (!pbUser) return false;

    const updateData: Record<string, any> = {};
    for (const field of PB_USER_FIELDS) {
      if (pbUser[field] !== undefined) {
        updateData[field] = pbUser[field];
      }
    }
    if (Object.keys(updateData).length === 0) return false;

    await prisma.user.update({ where: { id: userId }, data: updateData });
    return true;
  } catch {
    return false;
  }
}

export async function syncSubscriptionToPb(
  userId: string,
  membership: string,
  membershipExpiresAt: Date | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const admPb = await pbAdmin();

    const pbUser = await admPb.collection('users').getOne(userId).catch(() => null);
    if (!pbUser) {
      return { success: false, error: 'PB user record not found' };
    }

    await admPb.collection('users').update(userId, {
      membership,
      membershipExpiresAt: membershipExpiresAt ? membershipExpiresAt.toISOString() : null,
    });

    try {
      const existingSessions = await admPb.collection('membership_transactions').getList(1, 50, {
        filter: `userId = "${userId}"`,
        sort: '-created',
      });

      if (membership !== 'free') {
        const latestTx = existingSessions.items[0];
        if (latestTx) {
          await admPb.collection('membership_transactions').update(latestTx.id, {
            paymentStatus: 'paid',
            planType: membership,
          });
        }
      }
    } catch {
      // non-fatal
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'PB sync failed' };
  }
}

export async function ensurePbUserCollectionFields(): Promise<void> {
  try {
    const admPb = await pbAdmin();
    const usersCol = await admPb.collections.getOne('users').catch(() => null);
    if (!usersCol) return;

    const existingFields = new Set(
      ((usersCol as any).schema || []).map((f: any) => f.name)
    );
    const missingFields: { name: string; type: string; options?: any }[] = [];
    const fieldDefs: Record<string, { type: string; options?: any }> = {
      points: { type: 'number' },
      theme: { type: 'text' },
      status: { type: 'select', options: { values: ['active', 'blacklisted', 'abnormal'] } },
      role: { type: 'select', options: { values: ['user', 'admin', 'editor'] } },
      membership: { type: 'text' },
      membershipExpiresAt: { type: 'date' },
      memberSince: { type: 'date' },
      blockedUntil: { type: 'date' },
      blacklistReason: { type: 'text' },
      aiDailyCapOverride: { type: 'number' },
      aiAgentReactivatesAt: { type: 'date' },
    };

    for (const [name, def] of Object.entries(fieldDefs)) {
      if (!existingFields.has(name)) {
        missingFields.push({ name, ...def });
      }
    }

    if (missingFields.length > 0) {
      const newSchema = [...((usersCol as any).schema || [])];
      for (const field of missingFields) {
        newSchema.push({ name: field.name, type: field.type, required: false, unique: false, options: field.options });
      }
      await admPb.collections.update(usersCol.id, { schema: newSchema });
    }
  } catch {
    // non-fatal
  }
}
