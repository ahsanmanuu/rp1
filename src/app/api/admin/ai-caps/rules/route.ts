import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSessionFromRequest } from '@/lib/adminAuth';
import { clearRulesCache } from '@/lib/aiCapRules';
import { seedAiCapsDemoData } from '@/lib/seedAiCaps';

export async function GET(req: NextRequest) {
  const admin = await getAdminSessionFromRequest(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Seed demo rules if empty
  await seedAiCapsDemoData();

  try {
    const rules = await prisma.aiCapRule.findMany({
      orderBy: { priority: 'asc' },
    });

    const total = rules.length;
    const activeCount = rules.filter((r: any) => r.isActive).length;

    return NextResponse.json({
      success: true,
      rules,
      total,
      activeCount,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await getAdminSessionFromRequest(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const {
      name, description, matchType, matchValue, capType, capValue,
      agentFilter, priority, isActive,
    } = body;

    if (!name?.trim() || !matchType || !matchValue || !capType || capValue === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, matchType, matchValue, capType, capValue' },
        { status: 400 }
      );
    }

    const validMatchTypes = ['all_users', 'email_exact', 'email_domain', 'email_regex', 'ip_exact', 'ip_cidr', 'location_country', 'location_city'];
    const validCapTypes = ['daily_tokens', 'daily_requests', 'block'];

    if (!validMatchTypes.includes(matchType)) {
      return NextResponse.json(
        { success: false, error: `Invalid matchType. Must be one of: ${validMatchTypes.join(', ')}` },
        { status: 400 }
      );
    }
    if (!validCapTypes.includes(capType)) {
      return NextResponse.json(
        { success: false, error: `Invalid capType. Must be one of: ${validCapTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const existing = await prisma.aiCapRule.findUnique({ where: { name: name.trim() } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'A rule with this name already exists' },
        { status: 409 }
      );
    }

    const rule = await prisma.aiCapRule.create({
      data: {
        name: name.trim(),
        description: description || null,
        matchType,
        matchValue: matchValue.trim(),
        capType,
        capValue,
        agentFilter: agentFilter || '*',
        priority: priority ?? 100,
        isActive: isActive ?? true,
        createdBy: admin.email || null,
      },
    });

    clearRulesCache();

    return NextResponse.json({ success: true, rule }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const admin = await getAdminSessionFromRequest(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { id, ...fields } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing rule id' }, { status: 400 });
    }

    const existing = await prisma.aiCapRule.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Rule not found' }, { status: 404 });
    }

    if (fields.name && fields.name !== existing.name) {
      const duplicate = await prisma.aiCapRule.findUnique({ where: { name: fields.name.trim() } });
      if (duplicate) {
        return NextResponse.json({ success: false, error: 'A rule with this name already exists' }, { status: 409 });
      }
    }

    const updatable: any = {};
    if (fields.name !== undefined) updatable.name = fields.name.trim();
    if (fields.description !== undefined) updatable.description = fields.description;
    if (fields.isActive !== undefined) updatable.isActive = fields.isActive;
    if (fields.matchType !== undefined) updatable.matchType = fields.matchType;
    if (fields.matchValue !== undefined) updatable.matchValue = fields.matchValue.trim();
    if (fields.capType !== undefined) updatable.capType = fields.capType;
    if (fields.capValue !== undefined) updatable.capValue = fields.capValue;
    if (fields.agentFilter !== undefined) updatable.agentFilter = fields.agentFilter;
    if (fields.priority !== undefined) updatable.priority = fields.priority;

    const rule = await prisma.aiCapRule.update({
      where: { id },
      data: updatable,
    });

    clearRulesCache();

    return NextResponse.json({ success: true, rule });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const admin = await getAdminSessionFromRequest(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing rule id' }, { status: 400 });
    }

    const existing = await prisma.aiCapRule.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Rule not found' }, { status: 404 });
    }

    await prisma.aiCapRule.delete({ where: { id } });
    clearRulesCache();

    return NextResponse.json({ success: true, message: 'Rule deleted' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
