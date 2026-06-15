import { Router, type Request, type Response } from 'express'
import { getDb, saveDb, uuid, rowToObject, rowsToObjects, objectToCamel } from '../db.js'

const router = Router()

const roleNames: Record<string, string[]> = {
  citizen: ['市民', '用户'],
  organizer: ['组织者', '负责人'],
  volunteer: ['志愿者', '义工'],
}

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const db = await getDb()
  const { phone, role } = req.body

  if (!phone || !role) {
    res.status(400).json({ success: false, error: '缺少手机号或角色' })
    return
  }

  const result = db.exec('SELECT * FROM users WHERE phone = ?', [phone])
  if (result.length && result[0].values.length) {
    const user = objectToCamel(rowToObject(result[0]))
    if (user.role !== role) {
      db.run('UPDATE users SET role = ? WHERE id = ?', [role, user.id])
      saveDb()
      user.role = role
    }
    res.json({ success: true, data: user })
    return
  }

  const names = roleNames[role] || ['用户']
  const name = names[Math.floor(Math.random() * names.length)] + Math.floor(Math.random() * 1000)
  const id = uuid()
  const now = new Date().toISOString()

  db.run(
    'INSERT INTO users (id, phone, name, role, points, created_at) VALUES (?, ?, ?, ?, 0, ?)',
    [id, phone, name, role, now]
  )

  saveDb()

  res.json({
    success: true,
    data: { id, phone, name, role, points: 0 },
  })
})

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const db = await getDb()
  const { id } = req.params

  const result = db.exec('SELECT * FROM users WHERE id = ?', [id])
  if (!result.length || !result[0].values.length) {
    res.status(404).json({ success: false, error: '用户不存在' })
    return
  }

  const user = objectToCamel(rowToObject(result[0]))
  res.json({ success: true, data: user })
})

router.get('/:id/points', async (req: Request, res: Response): Promise<void> => {
  const db = await getDb()
  const { id } = req.params

  const userResult = db.exec('SELECT points FROM users WHERE id = ?', [id])
  if (!userResult.length || !userResult[0].values.length) {
    res.status(404).json({ success: false, error: '用户不存在' })
    return
  }
  const total = userResult[0].values[0][0] as number

  const ledgerResult = db.exec(
    `SELECT pl.*, a.name as activity_name
     FROM points_ledger pl
     LEFT JOIN activities a ON pl.activity_id = a.id
     WHERE pl.user_id = ?
     ORDER BY pl.created_at DESC`,
    [id]
  )

  const records = ledgerResult.length && ledgerResult[0].values.length
    ? rowsToObjects(ledgerResult[0]).map(r => {
        const c = objectToCamel(r)
        c.activityName = r.activity_name
        return c
      })
    : []

  res.json({ success: true, data: { total, records } })
})

export default router
