import { Router, type Request, type Response } from 'express'
import { getDb, saveDb, uuid, rowsToObjects, objectToCamel } from '../db.js'

const router = Router()

function simulateWeather() {
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

  return { temperature, condition, windSpeed, alertLevel }
}

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const db = await getDb()
  const { id } = req.params

  const actResult = db.exec('SELECT * FROM activities WHERE id = ?', [id])
  if (!actResult.length || !actResult[0].values.length) {
    res.status(404).json({ success: false, error: '活动不存在' })
    return
  }

  const segResult = db.exec(
    'SELECT * FROM route_segments WHERE activity_id = ? ORDER BY sort_order',
    [id]
  )
  const segments = segResult.length && segResult[0].values.length
    ? rowsToObjects(segResult[0]).map(s => {
        const c = objectToCamel(s)
        const currentLoad = Math.round(Math.random() * 100)
        return { ...c, currentLoad }
      })
    : []

  const weather = simulateWeather()

  res.json({
    success: true,
    data: { segments, weather },
  })
})

router.post('/:id/weather-cancel', async (req: Request, res: Response): Promise<void> => {
  const db = await getDb()
  const { id } = req.params

  const actResult = db.exec('SELECT * FROM activities WHERE id = ?', [id])
  if (!actResult.length || !actResult[0].values.length) {
    res.status(404).json({ success: false, error: '活动不存在' })
    return
  }

  db.run("UPDATE activities SET status = 'weather_cancelled' WHERE id = ?", [id])

  const confirmedRegs = db.exec(
    "SELECT id, user_id FROM registrations WHERE activity_id = ? AND status = 'confirmed'",
    [id]
  )
  const now = new Date().toISOString()
  let refundedCount = 0

  if (confirmedRegs.length && confirmedRegs[0].values.length) {
    for (const row of confirmedRegs[0].values) {
      const regId = row[0] as string
      const userId = row[1] as string
      db.run("UPDATE registrations SET status = 'refunded' WHERE id = ?", [regId])
      db.run(
        `INSERT INTO points_ledger (id, user_id, activity_id, points, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [uuid(), userId, id, 0, '活动因天气取消，自动退款', now]
      )
      refundedCount++
    }
  }

  const waitlistedRegs = db.exec(
    "SELECT id FROM registrations WHERE activity_id = ? AND status = 'waitlisted'",
    [id]
  )
  if (waitlistedRegs.length && waitlistedRegs[0].values.length) {
    for (const row of waitlistedRegs[0].values) {
      const regId = row[0] as string
      db.run("UPDATE registrations SET status = 'cancelled' WHERE id = ?", [regId])
    }
  }

  const notifiedCount = refundedCount + (waitlistedRegs.length ? waitlistedRegs[0].values.length : 0)

  saveDb()
  res.json({
    success: true,
    data: { refundedCount, notifiedCount },
  })
})

export default router
