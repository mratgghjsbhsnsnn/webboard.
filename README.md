# เว็บบอร์ด (Cloudflare Pages + D1)

ฟีเจอร์: สมัคร/เข้าสู่ระบบจริง, ตั้งกระทู้, ตอบกระทู้, แก้ไข/ลบ, กดถูกใจ, หมวดหมู่, ค้นหา, แบ่งหน้า, แชทส่วนตัว (อัปเดตทุก 4 วินาที), รายงาน, โปรไฟล์, แอดมิน (ปักหมุด/ล็อก/ลบ/ระงับ/จัดการหมวด/ดูรายงาน), ข้อตกลงการใช้งาน

## วิธีติดตั้ง
1. ติดตั้ง Node.js แล้วรัน `npm i -g wrangler` และ `wrangler login`
2. เข้าโฟลเดอร์โปรเจกต์ แล้วรัน `wrangler d1 create webboard-db` คัดลอก `database_id` ไปใส่ใน `wrangler.toml`
3. สร้างตาราง: `wrangler d1 execute webboard-db --remote --file=schema.sql`
4. สร้างโปรเจกต์: `wrangler pages project create webboard --production-branch=main`
5. อัปโหลด: `wrangler pages deploy public --project-name=webboard`
6. เปิดเว็บที่ให้มา แล้ว "สมัครสมาชิก" ด้วยอีเมลแอดมิน (ตั้งใน `ADMIN_EMAIL` ใน wrangler.toml) และตั้งรหัสผ่านของคุณเอง อีเมลนี้จะได้สิทธิ์แอดมินอัตโนมัติ

## ทดสอบในเครื่อง
`wrangler d1 execute webboard-db --local --file=schema.sql` แล้ว `wrangler pages dev public`

## ความปลอดภัย
- รหัสผ่านแฮช PBKDF2-SHA256 + salt, session เป็นคุกกี้ HttpOnly/Secure/SameSite
- ตรวจ Origin กัน CSRF, escape ข้อความทุกจุดกัน XSS, CSP ใน `public/_headers` บล็อกสคริปต์ภายนอกทั้งหมด
- ไม่ได้ใส่รหัสผ่านแอดมินไว้ในไฟล์ใดๆ
- ข้อจำกัด: ยังไม่มี rate limit (แนะนำเปิด Cloudflare WAF Rate Limiting) และไม่มีระบบกู้รหัสผ่านทางอีเมล (รีเซ็ตผ่าน D1 console)

## โครงสร้าง
public/ (index.html, style.css, app.js, terms.html, _headers) · functions/api/[[path]].js (API) · schema.sql · wrangler.toml
