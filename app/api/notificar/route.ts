import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { titulo, mensagem, url } = await request.json();

    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
        included_segments: ["All"],
        headings: { pt: titulo, en: titulo },
        contents: { pt: mensagem, en: mensagem },
        url: url ?? `${process.env.NEXT_PUBLIC_APP_URL}/admin/convites`,
        chrome_web_icon: "/icon-192.png",
      }),
    });

    const data = await response.json();
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}