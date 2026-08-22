import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const branches = await prisma.branch.findMany({
      orderBy: { code: 'asc' },
    });
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
          code,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
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
