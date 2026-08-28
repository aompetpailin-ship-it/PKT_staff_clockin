import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkGeofence } from '@/lib/geofence';
import { sendLineGroupNotification } from '@/lib/line';
import { syncToGoogleSheets } from '@/lib/googleSheets';
import { getThaiNow, getThaiDateStr } from '@/lib/dateUtils';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      employeeId,
      lineUserId,
      branchId,
      latitude,
      longitude,
      photoUrl,
      pinCode,
      deviceId,
      verificationMethod = 'PHOTO_SELFIE',
      notes,
    } = body;

    if ((!employeeId && !lineUserId) || !branchId || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { success: false, error: 'ข้อมูลไม่ครบถ้วน (ต้องการพนักงาน, สาขา และ พิกัด GPS)' },
        { status: 400 }
      );
    }

    // Find Employee
    const employee = employeeId
      ? await prisma.employee.findUnique({ where: { id: employeeId } })
      : await prisma.employee.findUnique({ where: { lineUserId } });

    if (!employee) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบข้อมูลพนักงานในระบบ' },
        { status: 404 }
      );
    }

    // ANTI-PROXY DEVICE BINDING SECURITY (ป้องกันการใช้เครื่องเดียวกันกดแทนกัน)
    if (deviceId) {
      if (!employee.boundDeviceId) {
        // First time clock-in: bind this phone device to employee
        await prisma.employee.update({
          where: { id: employee.id },
          data: { boundDeviceId: deviceId },
        });
      } else if (employee.boundDeviceId !== deviceId) {
        // Device mismatch! Phone belongs to someone else!
        // Find who owns this device
        const deviceOwner = await prisma.employee.findFirst({
          where: { boundDeviceId: deviceId },
        });

        const ownerName = deviceOwner ? `${deviceOwner.fullName} (${deviceOwner.nickname || 'พนักงาน'})` : 'พนักงานคนอื่น';

        return NextResponse.json(
          {
            success: false,
            error: `⛔ ป้องกันการกดลงเวลาแทนกัน: โทรศัพท์เครื่องนี้ถูกผูกไว้กับ ${ownerName} ไม่สามารถใช้กดลงเวลาแทนกันได้ (หากเปลี่ยนเครื่องโทรศัพท์จริง กรุณาติดต่อผู้จัดการเพื่อปลดล็อกเครื่อง)`,
          },
          { status: 403 }
        );
      }
    }

    // Verification Checks
    if (verificationMethod === 'PIN_CODE') {
      if (!pinCode) {
        return NextResponse.json(
          { success: false, error: 'กรุณากรอกรหัส PIN ประจำตัว 4 หลัก' },
          { status: 400 }
        );
      }
      const expectedPin = employee.pinCode || '1234';
      if (pinCode.trim() !== expectedPin.trim()) {
        return NextResponse.json(
          { success: false, error: 'รหัส PIN ยืนยันตัวตนไม่ถูกต้อง (รหัสเริ่มต้นของพนักงาน: 1234)' },
          { status: 401 }
        );
      }
    } else if (verificationMethod === 'PHOTO_SELFIE') {
      if (!photoUrl) {
        return NextResponse.json(
          { success: false, error: 'กรุณาถ่ายรูป Selfie เพื่อยืนยันตัวตน หรือเลือกลงเวลาด้วยรหัส PIN' },
          { status: 400 }
        );
      }
    }

    // Find Branch
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบสาขาที่เลือก' },
        { status: 404 }
      );
    }

    // Check Roaming Permission
    if (!employee.canRoam && employee.homeBranchId !== branchId) {
      return NextResponse.json(
        { success: false, error: 'พนักงานไม่มีสิทธิ์เข้างานข้ามสาขานี้' },
        { status: 403 }
      );
    }

    // 1. Geofence Check
    const userLat = parseFloat(latitude);
    const userLng = parseFloat(longitude);
    const geofenceResult = checkGeofence(
      userLat,
      userLng,
      branch.latitude,
      branch.longitude,
      branch.allowedRadiusMeters
    );

    if (!geofenceResult.isWithinGeofence) {
      return NextResponse.json({
        success: false,
        error: `อยู่นอกพื้นที่สาขา ${branch.name} (ระยะห่าง ${geofenceResult.distanceMeters} เมตร, อนุญาตไม่เกิน ${branch.allowedRadiusMeters} เมตร)`,
        distanceMeters: geofenceResult.distanceMeters,
        allowedRadiusMeters: branch.allowedRadiusMeters,
      }, { status: 400 });
    }

    const now = getThaiNow();
    const dateStr = getThaiDateStr();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    // Check if active clock-in exists for today
    const existing = await prisma.attendance.findFirst({
      where: {
        employeeId: employee.id,
        dateStr,
        clockOutAt: null,
      },
    });

    if (existing) {
      return NextResponse.json({
        success: false,
        error: 'ท่านได้ลงเวลาเข้างานไว้แล้วในวันนี้ และยังไม่ได้ลงเวลาออกงาน',
        attendance: existing,
      }, { status: 400 });
    }

    // 2. Determine Shift Start Time (Specific Day Schedule vs Default Branch Shift)
    const specificSchedule = await prisma.branchSchedule.findUnique({
      where: {
        branchId_dayOfWeek: {
          branchId,
          dayOfWeek,
        },
      },
    });

    const shiftTimeStr = specificSchedule ? specificSchedule.shiftStartTime : (branch.shiftStartTime || "09:00");
    const [shiftHour, shiftMin] = shiftTimeStr.split(':').map(Number);

    const shiftTotalMinutes = shiftHour * 60 + shiftMin;
    const nowThaiHour = now.getHours();
    const nowThaiMin = now.getMinutes();
    const nowTotalMinutes = nowThaiHour * 60 + nowThaiMin;

    let lateMinutes = 0;
    let status = 'ON_TIME';

    if (nowTotalMinutes > shiftTotalMinutes) {
      lateMinutes = nowTotalMinutes - shiftTotalMinutes;
      if (lateMinutes > 30) {
        status = 'ABSENT'; // เกิน 30 นาทีขึ้นไป ถือเป็นขาดงาน
      } else if (lateMinutes > 15) {
        status = 'LATE';   // เกิน 15 นาทีขึ้นไป ถือเป็นมาสาย
      } else {
        status = 'ON_TIME'; // อนุโลม 15 นาทีแรก ถือว่าตรงเวลา
      }
    }

    const methodLabel = verificationMethod === 'PIN_CODE' ? '🔑 ยืนยันด้วยรหัส PIN (ล็อกเครื่อง)' : verificationMethod === 'MANAGER_OVERRIDE' ? '👤 ผู้จัดการลงเวลาแทน' : '🔑 ยืนยันด้วยรหัส PIN (ล็อกเครื่อง)';

    const statusLabel = status === 'ABSENT' ? `🛑 ขาดงาน (สายเกิน 30 นาที - สาย ${lateMinutes} นาที)` : status === 'LATE' ? `⚠️ มาสาย ${lateMinutes} นาที` : '✅ ตรงเวลา';

    // Save Attendance Record
    const attendance = await prisma.attendance.create({
      data: {
        employeeId: employee.id,
        branchId: branch.id,
        dateStr,
        clockInAt: now,
        clockInPhotoUrl: photoUrl || null,
        verificationMethod,
        deviceId: deviceId || null,
        clockInLat: userLat,
        clockInLng: userLng,
        distanceMeters: geofenceResult.distanceMeters,
        lateMinutes,
        status,
        notes: notes || `เข้างานกะเวลา ${shiftTimeStr} น. (${methodLabel})`,
      },
      include: {
        employee: true,
        branch: true,
      },
    });

    const thaiFormattedTime = now.toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' });

    // Send LINE Notification Broadcast (if LINE Token configured)
    const lineMsg = `🟢 [ร้านผมขอทอด] แจ้งเตือนเข้างาน!\n👤 พนักงาน: ${employee.fullName} (${employee.nickname || 'พนักงาน'})\n🏪 สาขา: ${branch.name}\n⏰ เวลา: ${thaiFormattedTime} น.\n📌 สถานะ: ${statusLabel}\n🔐 วิธียืนยัน: ${methodLabel}`;
    sendLineGroupNotification(lineMsg, photoUrl && photoUrl.startsWith('http') ? photoUrl : undefined).catch((err: any) => console.error(err));

    // Backup / Sync to Google Sheets
    syncToGoogleSheets({
      type: 'CLOCK_IN',
      data: {
        dateStr,
        timeStr: thaiFormattedTime,
        employeeName: employee.fullName,
        nickname: employee.nickname,
        branchCode: branch.code,
        branchName: branch.name,
        status: statusLabel,
        lateMinutes,
        verificationMethod,
        notes: attendance.notes,
      },
    }).catch((err: any) => console.error(err));

    return NextResponse.json({
      success: true,
      message: `ลงเวลาเข้างานเรียบร้อยแล้ว (${statusLabel} - ${methodLabel})`,
      attendance,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
