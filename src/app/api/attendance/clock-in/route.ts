import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkGeofence } from '@/lib/geofence';
import { sendLineGroupNotification } from '@/lib/line';
import { syncToGoogleSheets } from '@/lib/googleSheets';
import { getThaiNow, getThaiDateStr, getThaiHourAndMinute } from '@/lib/dateUtils';
import { calculateDailySalesBonus } from '@/lib/bonusEngine';

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

    // Find Employee and Branch concurrently for maximum speed
    const [employee, branch] = await Promise.all([
      employeeId
        ? prisma.employee.findUnique({ where: { id: employeeId } })
        : prisma.employee.findUnique({ where: { lineUserId } }),
      prisma.branch.findUnique({ where: { id: branchId } }),
    ]);

    if (!employee) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบข้อมูลพนักงานในระบบ' },
        { status: 404 }
      );
    }

    if (!branch) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบสาขาที่เลือก' },
        { status: 404 }
      );
    }

    // 1. Verification Checks (PIN / Photo)
    if (verificationMethod === 'PIN_CODE') {
      if (!pinCode) {
        return NextResponse.json(
          { success: false, error: 'กรุณากรอกรหัส PIN ประจำตัวพนักงาน (4-6 หลัก)' },
          { status: 400 }
        );
      }
      const expectedPin = employee.pinCode || '1234';
      if (pinCode.trim() !== expectedPin.trim()) {
        return NextResponse.json(
          { success: false, error: 'รหัส PIN ยืนยันตัวตนไม่ถูกต้อง (กรุณาตรวจสอบรหัส PIN 4-6 หลักของท่าน หรือสอบถามผู้จัดการ)' },
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

    // 2. DEVICE BINDING & SHARED DEVICE DETECTION (ยืดหยุ่น ไม่บล็อกคนเปิดผ่าน Safari/LINE แต่ตรวจจับและแจ้งเตือนกรณีใช้เครื่องร่วมกัน)
    let sharedDeviceOwnerName = '';
    if (deviceId) {
      if (!employee.boundDeviceId) {
        // First time clock-in: bind this phone device to employee
        prisma.employee
          .update({
            where: { id: employee.id },
            data: { boundDeviceId: deviceId },
          })
          .catch((err) => console.error('[Device Binding Error]', err));
      } else if (employee.boundDeviceId !== deviceId) {
        // Check if this device is registered to another employee
        const otherOwner = await prisma.employee.findFirst({
          where: {
            boundDeviceId: deviceId,
            id: { not: employee.id },
          },
        });

        if (otherOwner) {
          sharedDeviceOwnerName = `${otherOwner.fullName} (${otherOwner.nickname || 'พนักงาน'})`;
          console.log(`[Shared Device] ${employee.fullName} clocked in using device of ${sharedDeviceOwnerName}`);
        } else {
          // Device is not bound to anyone else (e.g. employee cleared browser cache, opened in Safari, or got new phone)
          // Smoothly update bound device to new device without blocking
          prisma.employee
            .update({
              where: { id: employee.id },
              data: { boundDeviceId: deviceId },
            })
            .catch((err) => console.error('[Device Re-bind Error]', err));
        }
      }
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

    const now = new Date();
    const dateStr = getThaiDateStr(now);
    // Get dayOfWeek 0-6 in Thailand Time
    const thaiDayStr = now.toLocaleDateString("en-US", { timeZone: "Asia/Bangkok", weekday: "short" });
    const dayOfWeekMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const dayOfWeek = dayOfWeekMap[thaiDayStr] !== undefined ? dayOfWeekMap[thaiDayStr] : now.getDay();

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
    const { hour: nowThaiHour, minute: nowThaiMin } = getThaiHourAndMinute(now);
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
        notes: sharedDeviceOwnerName
          ? (notes ? `${notes} | ใช้เครื่องเดียวกับ ${sharedDeviceOwnerName}` : `ใช้เครื่องเดียวกับ ${sharedDeviceOwnerName}`)
          : notes || null,
      },
      include: {
        employee: true,
        branch: true,
      },
    });

    const thaiFormattedTime = now.toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' });

    // Option 1 Quota Saver: Send LINE Notification for Late / Absent OR Shared Device usage
    if (status === 'LATE' || status === 'ABSENT' || lateMinutes > 15 || sharedDeviceOwnerName) {
      let lineMsg = `🚨 [ร้านผมขอทอด] แจ้งเตือนเข้างาน!\n👤 พนักงาน: ${employee.fullName} (${employee.nickname || 'พนักงาน'})\n🏪 สาขา: ${branch.name}\n⏰ เวลา: ${thaiFormattedTime} น.\n📌 สถานะ: ${statusLabel}\n🔐 วิธียืนยัน: ${methodLabel}`;
      if (sharedDeviceOwnerName) {
        lineMsg += `\n📱 หมายเหตุ: ใช้เครื่องเดียวกับ ${sharedDeviceOwnerName} (ยืนยัน PIN ถูกต้อง)`;
      }
      sendLineGroupNotification(lineMsg, photoUrl && photoUrl.startsWith('http') ? photoUrl : undefined).catch((err: any) => console.error(err));
    }

    // Auto-update Daily Sales Bonus if sales record already submitted today for this branch
    (async () => {
      try {
        const existingSales = await prisma.dailySales.findFirst({
          where: { branchId, dateStr },
        });
        if (existingSales) {
          const attendances = await prisma.attendance.findMany({
            where: { branchId, dateStr },
            include: { employee: true },
          });
          const empMap = new Map();
          attendances.forEach((att) => {
            if (!empMap.has(att.employeeId)) empMap.set(att.employeeId, att.employee);
          });
          const workingEmps = Array.from(empMap.values());
          const fullTimeEmps = workingEmps.filter((e) => e.employmentType !== 'PART_TIME');

          const bonusResult = calculateDailySalesBonus(existingSales.totalSales, fullTimeEmps.length);

          await prisma.bonusPayout.deleteMany({
            where: { dailySalesId: existingSales.id },
          });

          if (bonusResult.isQualified && bonusResult.bonusPerPerson > 0) {
            for (const emp of fullTimeEmps) {
              await prisma.bonusPayout.create({
                data: {
                  dailySalesId: existingSales.id,
                  employeeId: emp.id,
                  branchId,
                  dateStr,
                  amount: bonusResult.bonusPerPerson,
                  reason: bonusResult.reason,
                },
              });
            }
          }
        }
      } catch (err) {
        console.error('[Auto Sales Bonus Sync Error]', err);
      }
    })();

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
