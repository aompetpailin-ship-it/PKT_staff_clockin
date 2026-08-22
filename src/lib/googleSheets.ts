/**
 * Google Sheets Real-time Sync Helper for PKT Staff Clock-In
 */

export async function syncToGoogleSheets(payload: {
  type: 'CLOCK_IN' | 'DAILY_SALES' | 'LEAVE';
  data: any;
}) {
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log('[Google Sheets] No GOOGLE_SHEETS_WEBHOOK_URL set. Skipping Google Sheets sync.');
    return;
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error('[Google Sheets Sync Error]', await res.text());
    } else {
      console.log('[Google Sheets Sync Success]', payload.type);
    }
  } catch (error) {
    console.error('[Google Sheets Sync Exception]', error);
  }
}
