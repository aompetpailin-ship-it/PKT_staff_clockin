import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const DEFAULT_BRANCHES = [
  {
    code: 'B1',
    name: 'B1_Ladphrao',
    latitude: 13.814321,
    longitude: 100.561234,
    allowedRadiusMeters: 5.0,
    shiftStartTime: '09:00',
  },
  {
    code: 'B2',
    name: 'B2_Theprak',
    latitude: 13.886123,
    longitude: 100.612345,
    allowedRadiusMeters: 100.0,
    shiftStartTime: '09:00',
  },
  {
    code: 'B3',
    name: 'B3_Muangthong',
    latitude: 13.912345,
    longitude: 100.551234,
    allowedRadiusMeters: 100.0,
    shiftStartTime: '09:00',
  },
  {
    code: 'B4',
    name: 'B4_Pinklao',
    latitude: 13.771234,
    longitude: 100.478910,
    allowedRadiusMeters: 100.0,
    shiftStartTime: '09:00',
  },
];

export async function GET() {
  try {
    let branches = await prisma.branch.findMany({
      orderBy: { code: 'asc' },
    });

    // Auto-seed or update default 4 branches if missing or empty
    if (branches.length === 0) {
      console.log('No branches found in DB. Auto-seeding default 4 branches...');
      for (const b of DEFAULT_BRANCHES) {
        await prisma.branch.upsert({
          where: { code: b.code },
          update: { name: b.name, allowedRadiusMeters: b.allowedRadiusMeters },
          create: b,
        });
      }
      branches = await prisma.branch.findMany({
        orderBy: { code: 'asc' },
      });
    }

    return NextResponse.json({ success: true, branches });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, name, code, latitude, longitude, allowedRadiusMeters, shiftStartTime } = body;

    let branch;
    if (id) {
      // Update existing branch
      branch = await prisma.branch.update({
        where: { id },
        data: {
          ...(name ? { name } : {}),
          ...(code ? { code } : {}),
          ...(latitude !== undefined ? { latitude: parseFloat(latitude) } : {}),
          ...(longitude !== undefined ? { longitude: parseFloat(longitude) } : {}),
          ...(allowedRadiusMeters !== undefined ? { allowedRadiusMeters: parseFloat(allowedRadiusMeters) } : {}),
          ...(shiftStartTime ? { shiftStartTime } : {}),
        },
      });
    } else {
      // Create new branch
      branch = await prisma.branch.create({
        data: {
          name,
          code: code || `B${Date.now()}`,
          latitude: parseFloat(latitude || 13.8),
          longitude: parseFloat(longitude || 100.5),
          allowedRadiusMeters: parseFloat(allowedRadiusMeters || 100),
          shiftStartTime: shiftStartTime || '09:00',
        },
      });
    }

    return NextResponse.json({ success: true, branch });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
