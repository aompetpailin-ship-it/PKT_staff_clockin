import { NextResponse } from 'next/server';

const ALLOWED_ADMINS = ['aommyisme', 'pon'];
const ADMIN_PASSWORD = '664662';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    const trimmedUsername = (username || '').trim().toLowerCase();
    const trimmedPassword = (password || '').trim();

    if (!ALLOWED_ADMINS.includes(trimmedUsername)) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบบัญชีผู้จัดการนี้ในระบบ (อนุญาตเฉพาะ aommyisme และ pon)' },
        { status: 401 }
      );
    }

    if (trimmedPassword !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { success: false, error: 'รหัสผ่านผู้จัดการไม่ถูกต้อง' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
      message: 'เข้าสู่ระบบสำเร็จ',
      user: {
        username: trimmedUsername === 'aommyisme' ? 'aommyisme' : 'pon',
        role: 'ADMIN',
      },
    });

    // Set HTTP-only Cookie for admin session
    response.cookies.set('pkt_admin_user', trimmedUsername, {
      httpOnly: false,
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
