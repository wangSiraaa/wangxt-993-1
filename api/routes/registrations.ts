import { Router, type Request, type Response } from 'express'
import { getDb, saveDb, uuid, rowsToObjects, rowToObject, objectToCamel } from '../db.js'

const router = Router()

function registrationToCamel(row: any): any {
  const c = objectToCamel(row)
  c.liabilitySigned = !!c.liabilitySigned
  c.equipmentConfirmed = !!c.equipmentConfirmed
  return c
}

router.post('/:id/register', async (req: Request, res: Response): Promise<void> => {
  const db = await getDb()
  const activityId = req.params.id
  const { name, phone, age, emergencyContact, emergencyPhone, liabilitySigned, equipmentConfirmed, userId } = req.body

  if (!name || !phone || !age || !userId) {
    res.status(400).json({ success: false, error: '缺少必填字段' })
    return
  }

  if (liabilitySigned !== true) {
    res.status(400).json({ success: false, error: '请先签署免责声明' })
    return
  }

  const actResult = db.exec('SELECT * FROM activities WHERE id = ?', [activityId])
  if (!actResult.length || !actResult[0].values.length) {
    res.status(404).json({ success: false, error: '活动不存在' })
    return
  }

  const activity = rowToObject(actResult[0])

  if (age < activity.age_min || age > activity.age_max) {
    res.status(400).json({ success: false, error: `年龄不符合要求，需要${activity.age_min}-${activity.age_max}岁` })
    return
  }

  if (equipmentConfirmed !== true) {
    res.status(400).json({ success: false, error: '请确认装备要求' })
    return
  }

  const dupResult = db.exec(
    "SELECT id FROM registrations WHERE activity_id = ? AND phone = ? AND status IN ('confirmed', 'waitlisted')",
    [activityId, phone]
  )
  if (dupResult.length && dupResult[0].values.length) {
    res.status(400).json({ success: false, error: '该手机号已报名此活动' })
    return
  }

  const cntResult = db.exec(
    "SELECT COUNT(*) as cnt FROM registrations WHERE activity_id = ? AND status = 'confirmed'",
    [activityId]
  )
  const currentCount = cntResult.length ? (cntResult[0].values[0][0] as number) : 0

  let status: string
  let waitlistPosition: number | null = null

  if (currentCount >= activity.capacity) {
    const wlMaxResult = db.exec(
      "SELECT MAX(waitlist_position) as max_pos FROM registrations WHERE activity_id = ? AND status = 'waitlisted'",
      [activityId]
    )
    const maxPos = wlMaxResult.length && wlMaxResult[0].values[0][0] ? (wlMaxResult[0].values[0][0] as number) : 0
    status = 'waitlisted'
    waitlistPosition = maxPos + 1
  } else {
    status = 'confirmed'
  }

  const id = uuid()
  const now = new Date().toISOString()

  db.run(
    `INSERT INTO registrations (id, activity_id, user_id, name, phone, age, emergency_contact, emergency_phone, liability_signed, equipment_confirmed, status, waitlist_position, registered_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, activityId, userId, name, phone, age, emergencyContact || '', emergencyPhone || '', liabilitySigned ? 1 : 0, equipmentConfirmed ? 1 : 0, status, waitlistPosition, now]
  )

  const newCntResult = db.exec(
    "SELECT COUNT(*) as cnt FROM registrations WHERE activity_id = ? AND status = 'confirmed'",
    [activityId]
  )
  const newCount = newCntResult.length ? (newCntResult[0].values[0][0] as number) : 0

  if (newCount >= activity.capacity && activity.status === 'open') {
    db.run("UPDATE activities SET status = 'full' WHERE id = ?", [activityId])
  }

  saveDb()

  const message = status === 'confirmed' ? '报名成功' : '报名成功，当前在候补列表中'
  res.status(201).json({
    success: true,
    data: { id, status, waitlistPosition, message },
  })
})

router.delete('/:regId', async (req: Request, res: Response): Promise<void> => {
  const db = await getDb()
  const { regId } = req.params

  const regResult = db.exec('SELECT * FROM registrations WHERE id = ?', [regId])
  if (!regResult.length || !regResult[0].values.length) {
    res.status(404).json({ success: false, error: '报名记录不存在' })
    return
  }

  const reg = rowToObject(regResult[0])

  const actResult = db.exec('SELECT * FROM activities WHERE id = ?', [reg.activity_id])
  if (!actResult.length || !actResult[0].values.length) {
    res.status(404).json({ success: false, error: '活动不存在' })
    return
  }
  const activity = rowToObject(actResult[0])

  if (activity.status === 'ended') {
    res.status(400).json({ success: false, error: '活动已结束，无法取消报名' })
    return
  }

  let newStatus: string
  if (activity.status === 'weather_cancelled') {
    newStatus = 'refunded'
  } else {
    newStatus = 'cancelled'
  }
  db.run('UPDATE registrations SET status = ? WHERE id = ?', [newStatus, regId])

  let promotedRegistration: { id: string; name: string } | null = null

  if (reg.status === 'confirmed') {
    const firstWaitlisted = db.exec(
      "SELECT id, name FROM registrations WHERE activity_id = ? AND status = 'waitlisted' ORDER BY waitlist_position ASC LIMIT 1",
      [reg.activity_id]
    )
    if (firstWaitlisted.length && firstWaitlisted[0].values.length) {
      const wlId = firstWaitlisted[0].values[0][0] as string
      const wlName = firstWaitlisted[0].values[0][1] as string
      db.run("UPDATE registrations SET status = 'confirmed', waitlist_position = NULL WHERE id = ?", [wlId])
      promotedRegistration = { id: wlId, name: wlName }
    }

    const cntResult = db.exec(
      "SELECT COUNT(*) as cnt FROM registrations WHERE activity_id = ? AND status = 'confirmed'",
      [reg.activity_id]
    )
    const currentCount = cntResult.length ? (cntResult[0].values[0][0] as number) : 0
    if (activity.status === 'full' && currentCount < activity.capacity) {
      db.run("UPDATE activities SET status = 'open' WHERE id = ?", [reg.activity_id])
    }
  }

  saveDb()
  res.json({
    success: true,
    data: { cancelled: true, promotedRegistration },
  })
})

router.get('/activity/:id', async (req: Request, res: Response): Promise<void> => {
  const db = await getDb()
  const { id } = req.params

  const result = db.exec(
    'SELECT * FROM registrations WHERE activity_id = ? ORDER BY registered_at ASC',
    [id]
  )

  const rows = result.length && result[0].values.length
    ? rowsToObjects(result[0]).map(r => registrationToCamel(r))
    : []

  res.json({ success: true, data: rows })
})

router.get('/user/:phone', async (req: Request, res: Response): Promise<void> => {
  const db = await getDb()
  const { phone } = req.params

  const result = db.exec(
    `SELECT r.id, r.activity_id, r.user_id, r.name, r.phone, r.age, r.emergency_contact, r.emergency_phone,
       r.liability_signed, r.equipment_confirmed, r.status, r.waitlist_position, r.registered_at,
       a.name as activity_name, a.date as activity_date, a.status as activity_status
     FROM registrations r
     JOIN activities a ON r.activity_id = a.id
     WHERE r.phone = ?
     ORDER BY r.registered_at DESC`,
    [phone]
  )

  const rows = result.length && result[0].values.length
    ? rowsToObjects(result[0]).map(r => {
        const c = registrationToCamel(r)
        c.activityName = r.activity_name
        c.activityDate = r.activity_date
        c.activityStatus = r.activity_status
        return c
      })
    : []

  res.json({ success: true, data: rows })
})

export default router
