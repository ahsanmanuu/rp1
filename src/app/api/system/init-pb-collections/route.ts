import { NextResponse } from 'next/server';
import { pbAdmin } from '@/lib/pb';

export const dynamic = 'force-dynamic';

const COLLECTIONS = [
  {
    name: 'home_content',
    type: 'base',
    schema: [
      { name: 'key', type: 'text', required: true },
      { name: 'value', type: 'json' },
      { name: 'section', type: 'text' },
      { name: 'isActive', type: 'bool' },
      { name: 'sortOrder', type: 'number' },
    ],
    indexes: ['CREATE UNIQUE INDEX idx_home_content_key ON home_content (key);'],
  },
  {
    name: 'how_it_works',
    type: 'base',
    schema: [
      { name: 'title', type: 'text', required: true },
      { name: 'description', type: 'text' },
      { name: 'stepNumber', type: 'number', required: true },
      { name: 'icon', type: 'text' },
      { name: 'videoUrl', type: 'url' },
      { name: 'imageUrl', type: 'url' },
      { name: 'isActive', type: 'bool' },
      { name: 'sortOrder', type: 'number' },
    ],
    indexes: ['CREATE INDEX idx_how_it_works_step ON how_it_works (stepNumber);'],
  },
  {
    name: 'gallery_items',
    type: 'base',
    schema: [
      { name: 'title', type: 'text', required: true },
      { name: 'imageUrl', type: 'url' },
      { name: 'icon', type: 'text' },
      { name: 'category', type: 'text' },
      { name: 'isActive', type: 'bool' },
      { name: 'sortOrder', type: 'number' },
    ],
    indexes: [],
  },
  {
    name: 'institution_logos',
    type: 'base',
    schema: [
      { name: 'name', type: 'text', required: true },
      { name: 'logoUrl', type: 'url' },
      { name: 'icon', type: 'text' },
      { name: 'isActive', type: 'bool' },
      { name: 'sortOrder', type: 'number' },
    ],
    indexes: [],
  },
  {
    name: 'features',
    type: 'base',
    schema: [
      { name: 'title', type: 'text', required: true },
      { name: 'description', type: 'text' },
      { name: 'icon', type: 'text' },
      { name: 'iconBg', type: 'text' },
      { name: 'glow', type: 'text' },
      { name: 'tags', type: 'json' },
      { name: 'href', type: 'text' },
      { name: 'isActive', type: 'bool' },
      { name: 'sortOrder', type: 'number' },
    ],
    indexes: [],
  },
  {
    name: 'benefits',
    type: 'base',
    schema: [
      { name: 'title', type: 'text', required: true },
      { name: 'description', type: 'text' },
      { name: 'icon', type: 'text' },
      { name: 'color', type: 'text' },
      { name: 'isActive', type: 'bool' },
      { name: 'sortOrder', type: 'number' },
    ],
    indexes: [],
  },
  {
    name: 'product_details',
    type: 'base',
    schema: [
      { name: 'key', type: 'text', required: true },
      { name: 'title', type: 'text', required: true },
      { name: 'description', type: 'text' },
      { name: 'icon', type: 'text' },
      { name: 'color', type: 'text' },
      { name: 'features', type: 'json' },
      { name: 'href', type: 'text' },
      { name: 'isActive', type: 'bool' },
      { name: 'sortOrder', type: 'number' },
    ],
    indexes: ['CREATE UNIQUE INDEX idx_product_details_key ON product_details (key);'],
  },
  {
    name: 'footer_links',
    type: 'base',
    schema: [
      { name: 'groupTitle', type: 'text', required: true },
      { name: 'label', type: 'text', required: true },
      { name: 'href', type: 'text' },
      { name: 'linkKey', type: 'text' },
      { name: 'isTargetBlank', type: 'bool' },
      { name: 'isActive', type: 'bool' },
      { name: 'sortOrder', type: 'number' },
    ],
    indexes: ['CREATE INDEX idx_footer_links_group ON footer_links (groupTitle);'],
  },
  {
    name: 'tasar_stats',
    type: 'base',
    schema: [
      { name: 'label', type: 'text', required: true },
      { name: 'value', type: 'number', required: true },
      { name: 'suffix', type: 'text' },
      { name: 'icon', type: 'text' },
      { name: 'color', type: 'text' },
      { name: 'category', type: 'text' },
      { name: 'isActive', type: 'bool' },
      { name: 'sortOrder', type: 'number' },
    ],
    indexes: ['CREATE INDEX idx_tasar_stats_category ON tasar_stats (category);'],
  },
  {
    name: 'platform_stats',
    type: 'base',
    schema: [
      { name: 'key', type: 'text', required: true },
      { name: 'label', type: 'text' },
      { name: 'value', type: 'number', required: true },
      { name: 'suffix', type: 'text' },
      { name: 'decimals', type: 'number' },
      { name: 'isActive', type: 'bool' },
    ],
    indexes: ['CREATE UNIQUE INDEX idx_platform_stats_key ON platform_stats (key);'],
  },
  {
    name: 'site_settings',
    type: 'base',
    schema: [
      { name: 'key', type: 'text', required: true },
      { name: 'value', type: 'json' },
      { name: 'label', type: 'text' },
      { name: 'logo', type: 'file', options: { maxSelect: 1, maxSize: 5242880, mimeTypes: ['image/png', 'image/jpeg', 'image/svg+xml'] } },
    ],
    indexes: ['CREATE UNIQUE INDEX idx_site_settings_key ON site_settings (key);'],
  },
  {
    name: 'uploads',
    type: 'base',
    schema: [
      { name: 'file', type: 'file', required: true, options: { maxSelect: 1, maxSize: 10485760 } },
    ],
    indexes: [],
  },
  {
    name: 'floating_banners',
    type: 'base',
    schema: [
      { name: 'title', type: 'text', required: true },
      { name: 'imageUrl', type: 'url' },
      { name: 'linkUrl', type: 'url' },
      { name: 'targetType', type: 'text' },
      { name: 'targetEmail', type: 'email' },
      { name: 'width', type: 'number' },
      { name: 'height', type: 'number' },
      { name: 'duration', type: 'number' },
      { name: 'isActive', type: 'bool' },
      { name: 'sortOrder', type: 'number' },
    ],
    indexes: [],
  },
];

function mapSchemaToFields(schema: any[]) {
  return schema.map((f: any) => {
    const field: any = {
      name: f.name,
      type: f.type,
      required: f.required || false,
      unique: f.unique || false,
    };
    if (f.options) field.options = f.options;
    return field;
  });
}

function getFieldNames(schema: any[]) {
  return new Set(schema.map((f: any) => f.name));
}

export async function POST() {
  try {
    const pb = await pbAdmin();
    const existing = await pb.collections.getFullList();
    const existingMap = new Map(existing.map((c: any) => [c.name, c]));
    const created: string[] = [];
    const updated: string[] = [];

    for (const col of COLLECTIONS) {
      const existingCol = existingMap.get(col.name);
      if (!existingCol) {
        // Create new collection
        await pb.collections.create({
          name: col.name,
          type: col.type,
          fields: [
            ...mapSchemaToFields(col.schema),
            { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
            { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
          ],
          indexes: col.indexes,
          listRule: null,
          viewRule: null,
          createRule: null,
          updateRule: null,
          deleteRule: null,
        });
        created.push(col.name);
      }
    }

    return NextResponse.json({ success: true, created, updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
