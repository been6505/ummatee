import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { decodeValue, cellValue, buildTable, decodeDoc, bangkokTime, a1, safeEqual, BACKUP_COLLECTIONS, META_SHEET } from './lib.js'
import { runBackup } from './index.js'

const ROOT = fileURLToPath(new URL('../../..', import.meta.url))

describe('แปลงค่า Firestore → ช่องในชีต', () => {
  it('ชนิดพื้นฐาน', () => {
    expect(decodeValue({ stringValue: 'ก' })).toBe('ก')
    expect(decodeValue({ integerValue: '42' })).toBe(42)
    expect(decodeValue({ doubleValue: 1.5 })).toBe(1.5)
    expect(decodeValue({ booleanValue: false })).toBe(false)
    expect(decodeValue({ nullValue: null })).toBe(null)
    expect(decodeValue({ referenceValue: 'projects/p/databases/(default)/documents/orders/x' })).toBe('orders/x')
  })
  it('เวลาเป็นเวลาไทย', () => {
    expect(cellValue(decodeValue({ timestampValue: '2026-11-06T07:00:00Z' }))).toBe('2026-11-06 14:00:00')
    expect(bangkokTime('nope')).toBe('nope')
  })
  it('array/map เป็น JSON และเวลาข้างในก็เป็นเวลาไทย', () => {
    const v = decodeValue({ mapValue: { fields: { seats: { arrayValue: { values: [{ stringValue: 'A1' }] } }, at: { timestampValue: '2026-01-01T00:00:00Z' } } } })
    expect(cellValue(v)).toBe('{"seats":["A1"],"at":"2026-01-01 07:00:00"}')
  })
  it('ตัดข้อความที่ยาวเกินช่องของ Google Sheets', () => {
    expect(cellValue('x'.repeat(60000)).length).toBeLessThan(50000)
  })
})

describe('สร้างตาราง', () => {
  it('รวมคอลัมน์จากทุกเอกสาร เรียงตาม id', () => {
    const docs = [
      { name: 'projects/p/databases/(default)/documents/c/b', fields: { name: { stringValue: 'บี' } } },
      { name: 'projects/p/databases/(default)/documents/c/a', fields: { phone: { stringValue: '08' }, amount: { integerValue: '100' } } },
    ].map(decodeDoc)
    expect(buildTable(docs)).toEqual([
      ['_id', 'amount', 'name', 'phone', '_updated'],
      ['a', 100, '', '08', ''],
      ['b', '', 'บี', '', ''],
    ])
  })
  it('collection ว่างยังได้หัวตาราง', () => {
    expect(buildTable([])).toEqual([['_id', '_updated']])
  })
  it('ชื่อแท็บใน A1 notation', () => {
    expect(a1("it's")).toBe("'it''s'")
  })
  it('ไม่สำรอง collection ที่มี token ลับ', () => {
    for (const c of ['socialAccounts', 'socialInsightsCache', 'pushTokens', 'chats']) expect(BACKUP_COLLECTIONS).not.toContain(c)
  })
  it('ทุก collection ที่สำรองมีอยู่จริงใน firestore.rules', () => {
    const rules = readFileSync(join(ROOT, 'firestore.rules'), 'utf8')
    for (const c of BACKUP_COLLECTIONS) expect(rules, c).toMatch(new RegExp(`match /${c}/`))
  })
  it('safeEqual', () => {
    expect(safeEqual('abc', 'abc')).toBe(true)
    expect(safeEqual('abc', 'abd')).toBe(false)
    expect(safeEqual('', undefined)).toBe(true)
    expect(safeEqual('a', '')).toBe(false)
  })
})

describe('runBackup (จำลอง Google API)', () => {
  it('ขอ token ด้วย JWT ที่เซ็นจริง แล้วเขียนทุกแท็บแบบ RAW + สรุปใน _backup', async () => {
    const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])
    const der = Buffer.from(await crypto.subtle.exportKey('pkcs8', kp.privateKey)).toString('base64')
    const sa = { client_email: 'backup@ummatee-app.iam.gserviceaccount.com', project_id: 'ummatee-app', private_key: `-----BEGIN PRIVATE KEY-----\n${der}\n-----END PRIVATE KEY-----\n` }
    const calls = []
    const writes = {}
    const fetchFn = async (url, init = {}) => {
      calls.push([init.method || 'GET', url])
      const ok = (body) => new Response(JSON.stringify(body), { status: 200 })
      if (url === 'https://oauth2.googleapis.com/token') {
        const assertion = new URLSearchParams(init.body).get('assertion')
        const [h, c, s] = assertion.split('.')
        const b = (x) => Uint8Array.from(atob(x.replace(/-/g, '+').replace(/_/g, '/')), (ch) => ch.charCodeAt(0))
        const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', kp.publicKey, b(s), new TextEncoder().encode(`${h}.${c}`))
        return valid ? ok({ access_token: 'tok' }) : new Response('{"error":"bad sig"}', { status: 400 })
      }
      expect(init.headers.Authorization).toBe('Bearer tok')
      if (url.includes('?fields=sheets.properties.title')) return ok({ sheets: [{ properties: { title: 'orders' } }] })
      if (url.endsWith(':batchUpdate')) return ok({})
      if (url.includes('firestore.googleapis.com')) {
        if (url.includes('/documents/nazaBookings')) {
          return url.includes('pageToken=p2')
            ? ok({ documents: [{ name: 'x/nazaBookings/b2', fields: { name: { stringValue: '=HYPERLINK("evil")' } } }] })
            : ok({ documents: [{ name: 'x/nazaBookings/b1', fields: { name: { stringValue: 'สมชาย' } } }], nextPageToken: 'p2' })
        }
        if (url.includes('/documents/donations')) return new Response('{"error":{"status":"PERMISSION_DENIED"}}', { status: 403 })
        return ok({})
      }
      if (url.includes(':clear')) return ok({})
      if (init.method === 'PUT') {
        expect(url).toContain('valueInputOption=RAW')
        writes[decodeURIComponent(url.split('/values/')[1].split('!')[0])] = JSON.parse(init.body).values
        return ok({})
      }
      throw new Error('unexpected ' + url)
    }

    const r = await runBackup({ GCP_SA_KEY: JSON.stringify(sa), BACKUP_SHEET_ID: 'SHEET', FIREBASE_PROJECT_ID: 'ummatee-app' }, fetchFn)

    // สร้างแท็บที่ขาด (ทุกแท็บยกเว้น orders ที่มีอยู่แล้ว)
    const add = calls.find(([, u]) => u.endsWith(':batchUpdate'))
    expect(add).toBeTruthy()
    // อ่านครบทั้ง 2 หน้า และข้อความที่ขึ้นต้นด้วย = ถูกเขียนแบบ RAW ตามตัวอักษร
    expect(writes["'nazaBookings'"]).toEqual([['_id', 'name', '_updated'], ['b1', 'สมชาย', ''], ['b2', '=HYPERLINK("evil")', '']])
    // collection ที่ล้มไม่ทำให้ตัวอื่นไม่ถูกสำรอง และถูกบันทึกในแท็บสรุป
    expect(r.ok).toBe(false)
    expect(r.failed.map((f) => f.collection)).toEqual(['donations'])
    const meta = writes[`'${META_SHEET}'`]
    expect(meta.find((row) => row[0] === 'donations')[2]).toBe('error')
    expect(meta.find((row) => row[0] === 'nazaBookings')).toEqual(['nazaBookings', 2, 'ok', ''])
    expect(Object.keys(writes)).toHaveLength(BACKUP_COLLECTIONS.length) // ทุก collection ที่ไม่ล้ม + _backup
  })

  it('บอกชัดเมื่อยังไม่ได้ตั้งค่า', async () => {
    await expect(runBackup({})).rejects.toThrow('GCP_SA_KEY')
    await expect(runBackup({ GCP_SA_KEY: '{}' })).rejects.toThrow('BACKUP_SHEET_ID')
  })
})

describe('public/_headers (Cloudflare Pages) ตรงกับ firebase.json', () => {
  it('หัวความปลอดภัยทุกตัว รวม CSP ตรงกันทุกตัวอักษร', () => {
    const fb = JSON.parse(readFileSync(join(ROOT, 'firebase.json'), 'utf8'))
    const pages = readFileSync(join(ROOT, 'public/_headers'), 'utf8')
    const global = fb.hosting.headers.filter((h) => h.source === '**').flatMap((h) => h.headers).filter((h) => h.key !== 'Cache-Control')
    expect(global.length).toBeGreaterThan(3)
    for (const h of global) expect(pages).toContain(`  ${h.key}: ${h.value}\n`)
  })
})
