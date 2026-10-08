/**
 * LINE Messaging API & LIFF Integration Helper for PKT Staff Clock-In
 */

export async function sendLineGroupNotification(messageText: string, imageUrl?: string) {
  // 1. Check for LINE Notify Token (100% Free & Unlimited Messages per month)
  const notifyToken = process.env.LINE_NOTIFY_TOKEN;
  if (notifyToken) {
    try {
      const formData = new URLSearchParams();
      formData.append('message', '\n' + messageText);
      if (imageUrl && imageUrl.startsWith('http')) {
        formData.append('imageFullsize', imageUrl);
        formData.append('imageThumbnail', imageUrl);
      }

      const res = await fetch('https://notify-api.line.me/api/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Bearer ${notifyToken}`,
        },
        body: formData.toString(),
      });

      if (res.ok) {
        return; // Successfully sent via LINE Notify
      } else {
        const errText = await res.text();
        console.error('[LINE Notify API Error]', errText);
      }
    } catch (err) {
      console.error('[LINE Notify API Exception]', err);
    }
  }

  // 2. Fallback to LINE Messaging API Broadcast (LINE Official Account)
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.log('[LINE Bot] No LINE_CHANNEL_ACCESS_TOKEN or LINE_NOTIFY_TOKEN set. Skipping LINE notification.');
    return;
  }

  try {
    const bodyPayload: any = {
      messages: [
        {
          type: 'text',
          text: messageText,
        },
      ],
    };

    if (imageUrl) {
      bodyPayload.messages.push({
        type: 'image',
        originalContentUrl: imageUrl,
        previewImageUrl: imageUrl,
      });
    }

    const res = await fetch('https://api.line.me/v2/bot/message/broadcast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(bodyPayload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[LINE Messaging API Error]', errText);
    }
  } catch (error) {
    console.error('[LINE Messaging API Exception]', error);
  }
}

export async function sendLineUnderstaffedAlert(params: {
  branchName: string;
  dateStr: string;
  actualStaffCount: number;
  minRequiredStaff: number;
  salesAmount?: number;
  reason?: string;
}) {
  const { branchName, dateStr, actualStaffCount, minRequiredStaff, salesAmount, reason } = params;

  const msg =
    `🚨 [ร้านผมขอทอด] แจ้งเตือนพนักงานต่ำกว่าเกณฑ์ขั้นต่ำ!\n` +
    `🏬 สาขา: ${branchName}\n` +
    `📅 วันที่: ${dateStr}\n` +
    `👥 พนักงานเข้างานจริง: ${actualStaffCount} คน\n` +
    `🎯 ขั้นต่ำที่ระบบวางไว้: ${minRequiredStaff} คน\n` +
    (salesAmount ? `💰 ยอดขายสุทธิ: ${salesAmount.toLocaleString()} บาท\n` : '') +
    (reason ? `📌 รายละเอียด: ${reason}\n` : '') +
    `⚠️ กรุณาตรวจสอบการจัดกะหรือส่งพนักงานเสริมเพื่อความเรียบร้อย`;

  return sendLineGroupNotification(msg);
}

export async function sendLineMorningStaffingAlert(params: {
  branchName: string;
  dateStr: string;
  shiftStartTime: string;
  cutoffTime: string;
  clockedInCount: number;
  minRequiredStaff: number;
  clockedInStaffNames: string[];
  missingCount: number;
}) {
  const {
    branchName,
    dateStr,
    shiftStartTime,
    cutoffTime,
    clockedInCount,
    minRequiredStaff,
    clockedInStaffNames,
    missingCount,
  } = params;

  const staffListText =
    clockedInStaffNames.length > 0 ? clockedInStaffNames.join(', ') : 'ยังไม่มีพนักงานเข้างาน';

  const msg =
    `🚨 [ร้านผมขอทอด] แจ้งเตือนด่วน! พนักงานกะเช้าเข้างานไม่ครบเกณฑ์\n` +
    `🏬 สาขา: ${branchName}\n` +
    `📅 วันที่: ${dateStr}\n` +
    `⏰ เวลาเริ่มกะ: ${shiftStartTime} น. | ตัดรอบ (สายเกิน 30 นาที): ${cutoffTime} น.\n` +
    `👥 เข้างานแล้ว: ${clockedInCount} คน (${staffListText})\n` +
    `🛑 ขาดงาน/ยังไม่เข้า: ${missingCount} คน\n` +
    `🎯 เกณฑ์ขั้นต่ำประจำสาขา: ${minRequiredStaff} คน\n` +
    `⚠️ ข้อเสนอแนะ: พนักงานขาด ${missingCount} คน กรุณาประสานงานย้ายพนักงานจากสาขาอื่นมาช่วยงานด่วน!`;

  return sendLineGroupNotification(msg);
}
