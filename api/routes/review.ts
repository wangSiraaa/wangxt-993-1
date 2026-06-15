import { Router, type Request, type Response } from 'express'
import { getDb, rowsToObjects, rowToObject, objectToCamel, parseActivityRow } from '../db.js'

const router = Router()

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
  const routeSegments = segResult.length && segResult[0].values.length
    ? rowsToObjects(segResult[0]).map(s => objectToCamel(s))
    : []

  activity.routeSegments = routeSegments

  const cntResult = db.exec(
    "SELECT COUNT(*) as cnt FROM registrations WHERE activity_id = ? AND status = 'confirmed'",
    [id]
  )
  const confirmedCount = cntResult.length ? (cntResult[0].values[0][0] as number) : 0

  const wlResult = db.exec(
    "SELECT COUNT(*) as cnt FROM registrations WHERE activity_id = ? AND status = 'waitlisted'",
    [id]
  )
  const waitlistCount = wlResult.length ? (wlResult[0].values[0][0] as number) : 0

  const cancelResult = db.exec(
    "SELECT COUNT(*) as cnt FROM registrations WHERE activity_id = ? AND status = 'cancelled'",
    [id]
  )
  const cancelledCount = cancelResult.length ? (cancelResult[0].values[0][0] as number) : 0

  const refundResult = db.exec(
    "SELECT COUNT(*) as cnt FROM registrations WHERE activity_id = ? AND status = 'refunded'",
    [id]
  )
  const refundCount = refundResult.length ? (refundResult[0].values[0][0] as number) : 0

  const totalRegistrations = confirmedCount + waitlistCount + cancelledCount + refundCount

  const checkedResult = db.exec(
    'SELECT COUNT(DISTINCT registration_id) as cnt FROM checkins WHERE activity_id = ?',
    [id]
  )
  const checkedIn = checkedResult.length ? (checkedResult[0].values[0][0] as number) : 0

  const excResult = db.exec(
    'SELECT COUNT(*) as cnt FROM checkins WHERE activity_id = ? AND is_exception = 1',
    [id]
  )
  const exceptionCount = excResult.length ? (excResult[0].values[0][0] as number) : 0

  const checkinRate = confirmedCount > 0 ? checkedIn / confirmedCount : 0

  const pointsResult = db.exec(
    'SELECT COALESCE(SUM(points), 0) as total FROM points_ledger WHERE activity_id = ?',
    [id]
  )
  const totalPointsIssued = pointsResult.length ? (pointsResult[0].values[0][0] as number) : 0

  activity.currentCount = confirmedCount
  activity.waitlistCount = waitlistCount

  const excListResult = db.exec(
    `SELECT c.registration_id, r.name, c.note, c.checked_in_at
     FROM checkins c
     JOIN registrations r ON c.registration_id = r.id
     WHERE c.activity_id = ? AND c.is_exception = 1`,
    [id]
  )
  const exceptions = excListResult.length && excListResult[0].values.length
    ? rowsToObjects(excListResult[0]).map(e => ({
        registrationId: e.registration_id,
        name: e.name,
        note: e.note,
        createdAt: e.checked_in_at,
      }))
    : []

  const timeline: { time: string; event: string; detail: string }[] = []

  timeline.push({
    time: activity.createdAt,
    event: '活动创建',
    detail: `活动"${activity.name}"已创建`,
  })

  const regListResult = db.exec(
    'SELECT name, status, registered_at FROM registrations WHERE activity_id = ? ORDER BY registered_at ASC',
    [id]
  )
  if (regListResult.length && regListResult[0].values.length) {
    const regList = rowsToObjects(regListResult[0])
    for (const reg of regList) {
      const statusMap: Record<string, string> = {
        confirmed: '确认',
        waitlisted: '候补',
        cancelled: '取消',
        refunded: '已退款',
      }
      timeline.push({
        time: reg.registered_at,
        event: '用户报名',
        detail: `${reg.name} 报名（${statusMap[reg.status] || reg.status}）`,
      })
    }
  }

  const checkinListResult = db.exec(
    'SELECT r.name, c.checked_in_at FROM checkins c JOIN registrations r ON c.registration_id = r.id WHERE c.activity_id = ? ORDER BY c.checked_in_at ASC',
    [id]
  )
  if (checkinListResult.length && checkinListResult[0].values.length) {
    const checkinList = rowsToObjects(checkinListResult[0])
    for (const ci of checkinList) {
      timeline.push({
        time: ci.checked_in_at,
        event: '签到',
        detail: `${ci.name} 完成签到`,
      })
    }
  }

  const statusChanges: Record<string, { event: string; detail: string }> = {
    full: { event: '活动满员', detail: '报名人数已达上限' },
    ongoing: { event: '活动开始', detail: '活动正在进行中' },
    ended: { event: '活动结束', detail: '活动已结束' },
    weather_cancelled: { event: '天气取消', detail: '活动因天气原因取消' },
  }
  if (statusChanges[activity.status]) {
    timeline.push({
      time: activity.createdAt,
      event: statusChanges[activity.status].event,
      detail: statusChanges[activity.status].detail,
    })
  }

  timeline.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())

  res.json({
    success: true,
    data: {
      activity,
      stats: {
        totalRegistrations,
        confirmedCount,
        waitlistCount,
        cancelledCount,
        checkinRate,
        exceptionCount,
        totalPointsIssued,
        refundCount,
      },
      exceptions,
      timeline,
    },
  })
})

export default router
