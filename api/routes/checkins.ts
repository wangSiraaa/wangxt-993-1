import { Router, type Request, type Response } from 'express'
import { getDb, saveDb, uuid, rowsToObjects, objectToCamel } from '../db.js'

const router = Router()

function checkinToCamel(row: any): any {
  const c = objectToCamel(row)
  c.isException = !!c.isException
  return c
}

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const db = await getDb()
  const { activityId, registrationId, volunteerId, note, isException } = req.body

  if (!activityId || !registrationId || !volunteerId) {
    res.status(400).json({ success: false, error: '缺少必填字段' })
    return
  }

  const id = uuid()
  const now = new Date().toISOString()

  db.run(
    `INSERT INTO checkins (id, activity_id, registration_id, volunteer_id, is_exception, note, checked_in_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, activityId, registrationId, volunteerId, isException ? 1 : 0, note || '', now]
  )

  const regResult = db.exec('SELECT user_id FROM registrations WHERE id = ?', [registrationId])
  if (regResult.length && regResult[0].values.length) {
    const userId = regResult[0].values[0][0] as string
    db.run('UPDATE users SET points = points + 5 WHERE id = ?', [userId])
    db.run(
      `INSERT INTO points_ledger (id, user_id, activity_id, points, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [uuid(), userId, activityId, 5, '签到积分', now]
    )
  }

  saveDb()

  const checkinResult = db.exec('SELECT * FROM checkins WHERE id = ?', [id])
  const checkin = checkinResult.length && checkinResult[0].values.length
    ? checkinToCamel(rowsToObjects(checkinResult[0])[0])
    : { id }

  res.status(201).json({ success: true, data: checkin })
})

router.get('/activity/:id/stats', async (req: Request, res: Response): Promise<void> => {
  const db = await getDb()
  const { id } = req.params

  const regTotal = db.exec(
    "SELECT COUNT(*) as cnt FROM registrations WHERE activity_id = ? AND status = 'confirmed'",
    [id]
  )
  const total = regTotal.length ? (regTotal[0].values[0][0] as number) : 0

  const checkedResult = db.exec(
    'SELECT COUNT(DISTINCT registration_id) as cnt FROM checkins WHERE activity_id = ?',
    [id]
  )
  const checkedIn = checkedResult.length ? (checkedResult[0].values[0][0] as number) : 0

  const excResult = db.exec(
    'SELECT COUNT(*) as cnt FROM checkins WHERE activity_id = ? AND is_exception = 1',
    [id]
  )
  const exceptions = excResult.length ? (excResult[0].values[0][0] as number) : 0

  const notCheckedIn = total - checkedIn
  const checkinRate = total > 0 ? checkedIn / total : 0

  res.json({
    success: true,
    data: { total, checkedIn, notCheckedIn, exceptions, checkinRate },
  })
})

router.get('/activity/:id/list', async (req: Request, res: Response): Promise<void> => {
  const db = await getDb()
  const { id } = req.params

  const result = db.exec(
    'SELECT * FROM checkins WHERE activity_id = ? ORDER BY checked_in_at ASC',
    [id]
  )

  const rows = result.length && result[0].values.length
    ? rowsToObjects(result[0]).map(r => checkinToCamel(r))
    : []

  res.json({ success: true, data: rows })
})

export default router
