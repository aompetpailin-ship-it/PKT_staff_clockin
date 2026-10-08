/**
 * Thailand Timezone (Asia/Bangkok - UTC+7) Helper Utilities
 * ร้านไก่ทอด "ผมขอทอด" (Pom Khor Thod) - ระบบลงเวลาพนักงาน
 */

export function getThaiNow(): Date {
  return new Date();
}

export function getThaiDateStr(date: Date = new Date()): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  };
  const formatter = new Intl.DateTimeFormat("en-CA", options); // en-CA formats as YYYY-MM-DD
  return formatter.format(date);
}

export function getThaiMonthYearStr(date: Date = new Date()): string {
  return getThaiDateStr(date).slice(0, 7);
}

export function getThaiHourAndMinute(date: Date = new Date()): { hour: number; minute: number } {
  const timeString = date.toLocaleTimeString("en-US", {
    timeZone: "Asia/Bangkok",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
  const [hourStr, minStr] = timeString.split(':');
  let hour = parseInt(hourStr, 10);
  if (hour === 24) hour = 0;
  const minute = parseInt(minStr, 10);
  return { hour, minute };
}

export function getThaiTimeString(date: Date = new Date()): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  };
  return new Intl.DateTimeFormat("th-TH", options).format(date);
}

export function formatThaiDateTime(dateInput?: Date | string | null): string {
  if (!dateInput) return "-";
  const dateObj = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(dateObj.getTime())) return "-";

  const options: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };
  return new Intl.DateTimeFormat("th-TH", options).format(dateObj);
}
