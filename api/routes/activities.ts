import { Router, type Request, type Response } from 'express'
import { getDb, saveDb, uuid, rowsToObjects, rowToObject, objectToCamel, parseActivityRow } from '../db.js'

const router = Router()

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const db = await getDb()
  const { type, status, keyword } = req.query

  let sql = 'SELECT * FROM activities WHERE 1=1'
  const params: any[] = []

  if (type) {
    sql += ' AND type = ?'
    params.push(type)
  }
  if (status) {
    sql += ' AND status = ?'
    params.push(status)
  }
  if (keyword) {
    sql += ' AND name LIKE ?'
    params.push(`%${keyword}%`)
  }

  sql += ' ORDER BY date ASC'

  const results = db.exec(sql, params)
  if (!results.length || !results[0].values.length) {
    res.json({ success: true, data: [] })
    return
  }

  const activities = rowsToObjects(results[0]).map(row => parseActivityRow(row))

  for (const activity of activities) {
    const cntResult = db.exec(
      "SELECT COUNT(*) as cnt FROM registrations WHERE activity_id = ? AND status = 'confirmed'",
      [activity.id]
    )
    const currentCount = cntResult.length ? (cntResult[0].values[0][0] as number) : 0

    const wlResult = db.exec(
      "SELECT COUNT(*) as cnt FROM registrations WHERE activity_id = ? AND status = 'waitlisted'",
      [activity.id]
    )
    const waitlistCount = wlResult.length ? (wlResult[0].values[0][0] as number) : 0

    activity.currentCount = currentCount
    activity.waitlistCount = waitlistCount

    if (currentCount >= activity.capacity && activity.status === 'open') {
      db.run("UPDATE activities SET status = 'full' WHERE id = ?", [activity.id])
      activity.status = 'full'
    }
  }

  saveDb()
  res.json({ success: true, data: activities })
})

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const db = await getDb()
  const { id } = req.params

  const actResult = db.exec('SELECT * FROM activities WHERE id = ?', [id])
  if (!actResult.length || !actResult[0].values.length) {
    res.status(404).json({ success: false, error: '活动不存在' })
    return
  }

  const activity = parseActivityRow(rowToObject(actResult[0]))

  const segResult = db.exec(
    'SELECT * FROM route_segments WHERE activity_id = ? ORDER BY sort_order',
    [id]
  )
  const routeSegments = segResult.length
    ? rowsToObjects(segResult[0]).map(s => objectToCamel(s))
    : []

  const cntResult = db.exec(
    "SELECT COUNT(*) as cnt FROM registrations WHERE activity_id = ? AND status = 'confirmed'",
    [id]
  )
  const currentCount = cntResult.length ? (cntResult[0].values[0][0] as number) : 0

  const wlResult = db.exec(
    "SELECT COUNT(*) as cnt FROM registrations WHERE activity_id = ? AND status = 'waitlisted'",
    [id]
  )
  const waitlistCount = wlResult.length ? (wlResult[0].values[0][0] as number) : 0

  res.json({
    success: true,
    data: {
      ...activity,
      routeSegments,
      currentCount,
      waitlistCount,
    },
  })
})

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const db = await getDb()
  const {
    name, type, date, location, description, capacity,
    ageMin, ageMax, equipmentRequirements, refundRule,
    pointsReward, createdBy, routeSegments,
  } = req.body

  if (!name || !type || !date || !capacity || !createdBy) {
    res.status(400).json({ success: false, error: '缺少必填字段' })
    return
  }

  const id = uuid()
  const now = new Date().toISOString()

  db.run(
    `INSERT INTO activities (id, name, type, date, location, description, capacity, age_min, age_max, equipment_requirements, refund_rule, points_reward, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, name, type, date, location || '', description || '', capacity, ageMin || 0, ageMax || 100, JSON.stringify(equipmentRequirements || []), refundRule || '', pointsReward || 0, 'open', createdBy, now]
  )

  if (Array.isArray(routeSegments)) {
    for (let i = 0; i < routeSegments.length; i++) {
      const seg = routeSegments[i]
      db.run(
        `INSERT INTO route_segments (id, activity_id, name, distance, capacity, supply_info, risk_level, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuid(), id, seg.name, seg.distance || 0, seg.capacity || 0, seg.supplyInfo || '', seg.riskLevel || 'low', i + 1]
      )
    }
  }

  saveDb()
  res.status(201).json({ success: true, data: { id } })
})

router.put('/:id/status', async (req: Request, res: Response): Promise<void> => {
  const db = await getDb()
  const { id } = req.params
  const { status } = req.body

  const validStatuses = ['open', 'full', 'ongoing', 'ended', 'weather_cancelled']
  if (!validStatuses.includes(status)) {
    res.status(400).json({ success: false, error: '无效状态' })
    return
  }

  const existing = db.exec('SELECT id FROM activities WHERE id = ?', [id])
  if (!existing.length || !existing[0].values.length) {
    res.status(404).json({ success: false, error: '活动不存在' })
    return
  }

  db.run('UPDATE activities SET status = ? WHERE id = ?', [status, id])

  if (status === 'ended') {
    const actResult = db.exec('SELECT points_reward FROM activities WHERE id = ?', [id])
    const pointsReward = actResult.length ? (actResult[0].values[0][0] as number) : 0

    const regs = db.exec(
      "SELECT user_id FROM registrations WHERE activity_id = ? AND status = 'confirmed'",
      [id]
    )
    if (regs.length) {
      for (const row of regs[0].values) {
        const userId = row[0] as string
        db.run('UPDATE users SET points = points + ? WHERE id = ?', [pointsReward, userId])
        db.run(
          `INSERT INTO points_ledger (id, user_id, activity_id, points, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
          [uuid(), userId, id, pointsReward, '活动结束积分奖励', new Date().toISOString()]
        )
      }
    }
  }

  saveDb()
  res.json({ success: true, data: { id, status } })
})

router.get('/:id/weather', async (req: Request, res: Response): Promise<void> => {
  const db = await getDb()
  const { id } = req.params

  const existing = db.exec('SELECT id FROM activities WHERE id = ?', [id])
  if (!existing.length || !existing[0].values.length) {
    res.status(404).json({ success: false, error: '活动不存在' })
    return
  }

  const conditions: ('sunny' | 'cloudy' | 'rainy' | 'stormy')[] = ['sunny', 'cloudy', 'rainy', 'stormy']
  const condition = conditions[Math.floor(Math.random() * conditions.length)]
  const temperature = 10 + Math.round(Math.random() * 25)
  const windSpeed = Math.round(Math.random() * 40)

  let alertLevel: 'none' | 'yellow' | 'orange' | 'red'
  if (condition === 'stormy' || windSpeed > 30) {
    alertLevel = 'red'
  } else if (condition === 'rainy' || windSpeed > 20) {
    alertLevel = 'orange'
  } else if (windSpeed > 10) {
    alertLevel = 'yellow'
  } else {
    alertLevel = 'none'
  }

  res.json({
    success: true,
    data: { temperature, condition, windSpeed, alertLevel },
  })
})

export default router
