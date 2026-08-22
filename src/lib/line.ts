/**
 * LINE Messaging API & LIFF Integration Helper for PKT Staff Clock-In
 */

export async function sendLineGroupNotification(messageText: string, imageUrl?: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.log('[LINE Notify] No LINE_CHANNEL_ACCESS_TOKEN set. Skipping LINE message broadcast.');
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
      console.error('[LINE Notify Error]', errText);
    }
  } catch (error) {
    console.error('[LINE Notify Exception]', error);
  }
}
