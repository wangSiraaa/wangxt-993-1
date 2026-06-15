import { Router, type Request, type Response } from 'express'
import { getDb, saveDb, uuid, rowsToObjects, rowToObject, objectToCamel } from '../db.js'

const router = Router()

function logEvent(db: any, activityId: string, eventType: string, actorId: string | null, actorRole: string | null, detail: string, metadata: any = {}) {
  db.run(
    `INSERT INTO event_log (id, activity_id, event_type, actor_id, actor_role, detail, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuid(), activityId, eventType, actorId, actorRole, detail, JSON.stringify(metadata), new Date().toISOString()]
  )
}

router.post('/:id/route-switch', async (req: Request, res: Response): Promise<void> => {
  const db = await getDb()
  const { id } = req.params
  const { actorId } = req.body

  const actResult = db.exec('SELECT * FROM activities WHERE id = ?', [id])
  if (!actResult.length || !actResult[0].values.length) {
    res.status(404).json({ success: false, error: '活动不存在' })
    return
  }
  const activity = rowToObject(actResult[0])

  if (activity.status !== 'ongoing' && activity.status !== 'open' && activity.status !== 'full') {
    res.status(400).json({ success: false, error: '当前活动状态不允许改线' })
    return
  }

  const newVersion = (activity.route_version || 1) + 1
  db.run('UPDATE activities SET route_version = ?, status = ? WHERE id = ?', [newVersion, 'route_switched', id])

  const segResult = db.exec(
    'SELECT * FROM route_segments WHERE activity_id = ? AND route_version = ? ORDER BY sort_order',
    [id, newVersion]
  )
  const newSegments = segResult.length && segResult[0].values.length
    ? rowsToObjects(segResult[0]).map(s => objectToCamel(s))
    : []

  const confirmedRegs = db.exec(
    "SELECT id, user_id, name, team_id FROM registrations WHERE activity_id = ? AND status IN ('confirmed', 'route_switched')",
    [id]
  )
  const now = new Date().toISOString()
  let affectedCount = 0
  if (confirmedRegs.length && confirmedRegs[0].values.length) {
    for (const row of confirmedRegs[0].values) {
      const regId = row[0] as string
      db.run("UPDATE registrations SET status = 'route_switched' WHERE id = ?", [regId])
      affectedCount++
    }
  }

  logEvent(db, id, 'route_switch', actorId, 'organizer',
    `路线因天气切换为短线(v${newVersion})，${affectedCount}人受影响`,
    { oldVersion: activity.route_version, newVersion, affectedCount, newSegmentNames: newSegments.map((s: any) => s.name) }
  )

  saveDb()
  res.json({
    success: true,
    data: { newVersion, affectedCount, newSegments, activityStatus: 'route_switched' }
  })
})

router.post('/:id/suspend', async (req: Request, res: Response): Promise<void> => {
  const db = await getDb()
  const { id } = req.params
  const { actorId, reason } = req.body

  const actResult = db.exec('SELECT * FROM activities WHERE id = ?', [id])
  if (!actResult.length || !actResult[0].values.length) {
    res.status(404).json({ success: false, error: '活动不存在' })
    return
  }
  const activity = rowToObject(actResult[0])

  if (activity.status !== 'ongoing' && activity.status !== 'route_switched') {
    res.status(400).json({ success: false, error: '只有进行中的活动可以中止' })
    return
  }

  const previousStatus = activity.status
  db.run("UPDATE activities SET status = 'suspended' WHERE id = ?", [id])

  const confirmedRegs = db.exec(
    "SELECT user_id FROM registrations WHERE activity_id = ? AND status IN ('confirmed', 'route_switched')",
    [id]
  )
  const now = new Date().toISOString()
  let frozenCount = 0
  if (confirmedRegs.length && confirmedRegs[0].values.length) {
    for (const row of confirmedRegs[0].values) {
      const userId = row[0] as string
      const pointsResult = db.exec('SELECT points_reward FROM activities WHERE id = ?', [id])
      const pointsReward = pointsResult.length ? (pointsResult[0].values[0][0] as number) : 0
      if (pointsReward > 0) {
        db.run('UPDATE users SET points_frozen = points_frozen + ? WHERE id = ?', [pointsReward, userId])
        db.run(
          `INSERT INTO points_ledger (id, user_id, activity_id, points, reason, frozen, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
          [uuid(), userId, id, pointsReward, '活动中止，积分冻结', now]
        )
      }
      frozenCount++
    }
  }

  logEvent(db, id, 'suspended', actorId, 'organizer',
    `活动中止：${reason || '异常天气'}，${frozenCount}人积分冻结`,
    { previousStatus, reason, frozenCount }
  )

  saveDb()
  res.json({ success: true, data: { status: 'suspended', frozenCount } })
})

router.post('/:id/resume', async (req: Request, res: Response): Promise<void> => {
  const db = await getDb()
  const { id } = req.params
  const { actorId } = req.body

  const actResult = db.exec('SELECT * FROM activities WHERE id = ?', [id])
  if (!actResult.length || !actResult[0].values.length) {
    res.status(404).json({ success: false, error: '活动不存在' })
    return
  }
  const activity = rowToObject(actResult[0])

  if (activity.status !== 'suspended') {
    res.status(400).json({ success: false, error: '活动未处于中止状态' })
    return
  }

  db.run("UPDATE activities SET status = 'ongoing' WHERE id = ?", [id])

  const frozenRegs = db.exec(
    "SELECT user_id, points FROM points_ledger WHERE activity_id = ? AND frozen = 1",
    [id]
  )
  let unfrozenCount = 0
  const now = new Date().toISOString()
  if (frozenRegs.length && frozenRegs[0].values.length) {
    for (const row of frozenRegs[0].values) {
      const userId = row[0] as string
      const points = row[1] as number
      db.run('UPDATE users SET points_frozen = MAX(points_frozen - ?, 0) WHERE id = ?', [points, userId])
      db.run(
        `INSERT INTO points_ledger (id, user_id, activity_id, points, reason, frozen, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)`,
        [uuid(), userId, id, 0, '活动恢复，积分解冻', now]
      )
      unfrozenCount++
    }
  }

  logEvent(db, id, 'resumed', actorId, 'organizer',
    `活动恢复，${unfrozenCount}人积分解冻`,
    { unfrozenCount }
  )

  saveDb()
  res.json({ success: true, data: { status: 'ongoing', unfrozenCount } })
})

router.post('/:id/team-reduce', async (req: Request, res: Response): Promise<void> => {
  const db = await getDb()
  const { id } = req.params
  const { teamId, memberIds, actorId } = req.body

  if (!teamId || !Array.isArray(memberIds) || memberIds.length === 0) {
    res.status(400).json({ success: false, error: '缺少团队ID或成员ID' })
    return
  }

  const teamResult = db.exec('SELECT * FROM teams WHERE id = ? AND activity_id = ?', [teamId, id])
  if (!teamResult.length || !teamResult[0].values.length) {
    res.status(404).json({ success: false, error: '团队不存在' })
    return
  }
  const team = rowToObject(teamResult[0])

  const remainingMembers = db.exec(
    'SELECT id, name, is_leader FROM team_members WHERE team_id = ? AND withdrawn = 0',
    [teamId]
  )
  const activeMembers = remainingMembers.length && remainingMembers[0].values.length
    ? rowsToObjects(remainingMembers[0])
    : []

  const leadersInRemove = memberIds.filter((mid: string) =>
    activeMembers.some((m: any) => m.id === mid && m.is_leader)
  )
  if (leadersInRemove.length > 0) {
    const willRemainLeader = activeMembers.some((m: any) => !memberIds.includes(m.id) && m.is_leader)
    if (!willRemainLeader && activeMembers.length - memberIds.length > 0) {
      res.status(400).json({ success: false, error: '移除队长前请先指定新队长' })
      return
    }
    if (activeMembers.length - memberIds.length <= 0) {
      res.status(400).json({ success: false, error: '不能移除所有成员，请直接取消报名' })
      return
    }
  }

  const placeholders = memberIds.map(() => '?').join(',')
  db.run(
    `UPDATE team_members SET withdrawn = 1 WHERE id IN (${placeholders}) AND team_id = ?`,
    [...memberIds, teamId]
  )

  const newActiveCount = activeMembers.length - memberIds.length
  db.run('UPDATE teams SET member_count = ? WHERE id = ?', [newActiveCount, teamId])

  if (newActiveCount <= 1) {
    db.run('UPDATE teams SET can_depart = 0 WHERE id = ?', [teamId])
  }

  const removedNames = memberIds.map((mid: string) => {
    const m = activeMembers.find((am: any) => am.id === mid)
    return m ? m.name : mid
  })

  logEvent(db, id, 'team_reduce', actorId, 'citizen',
    `团队"${team.team_name}"减员：${removedNames.join('、')}退出，剩余${newActiveCount}人`,
    { teamId, removedMemberIds: memberIds, removedNames, newMemberCount: newActiveCount }
  )

  recalcDepartureList(db, id)

  saveDb()
  res.json({
    success: true,
    data: { teamId, newMemberCount: newActiveCount, removedNames }
  })
})

router.post('/:id/withdraw', async (req: Request, res: Response): Promise<void> => {
  const db = await getDb()
  const { id } = req.params
  const { registrationId, reason, actorId, actorRole } = req.body

  if (!registrationId) {
    res.status(400).json({ success: false, error: '缺少报名记录ID' })
    return
  }

  const regResult = db.exec('SELECT * FROM registrations WHERE id = ? AND activity_id = ?', [registrationId, id])
  if (!regResult.length || !regResult[0].values.length) {
    res.status(404).json({ success: false, error: '报名记录不存在' })
    return
  }
  const reg = rowToObject(regResult[0])

  if (reg.status !== 'confirmed' && reg.status !== 'route_switched') {
    res.status(400).json({ success: false, error: '当前状态不允许退赛' })
    return
  }

  const actResult = db.exec('SELECT * FROM activities WHERE id = ?', [id])
  const activity = actResult.length ? rowToObject(actResult[0]) : null

  db.run("UPDATE registrations SET status = 'withdrawn' WHERE id = ?", [registrationId])

  const now = new Date().toISOString()
  const withdrawalId = uuid()
  db.run(
    `INSERT INTO withdrawals (id, activity_id, registration_id, reason, refund_amount, refund_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [withdrawalId, id, registrationId, reason || '中途退赛', 0, 'pending', now]
  )

  if (reg.team_id) {
    const tmResult = db.exec(
      'SELECT id FROM team_members WHERE team_id = ? AND registration_id = ? AND withdrawn = 0',
      [reg.team_id, registrationId]
    )
    if (tmResult.length && tmResult[0].values.length) {
      for (const row of tmResult[0].values) {
        db.run('UPDATE team_members SET withdrawn = 1 WHERE id = ?', [row[0]])
      }
    }

    const remainingActive = db.exec(
      'SELECT COUNT(*) as cnt FROM team_members WHERE team_id = ? AND withdrawn = 0',
      [reg.team_id]
    )
    const remainingCount = remainingActive.length ? (remainingActive[0].values[0][0] as number) : 0
    db.run('UPDATE teams SET member_count = ? WHERE id = ?', [remainingCount, reg.team_id])

    if (remainingCount === 0) {
      db.run("UPDATE teams SET status = 'withdrawn' WHERE id = ?", [reg.team_id])
    } else if (remainingCount === 1) {
      db.run('UPDATE teams SET can_depart = 0 WHERE id = ?', [reg.team_id])
    }
  }

  const checkinResult = db.exec(
    'SELECT id FROM checkins WHERE registration_id = ? AND activity_id = ?',
    [registrationId, id]
  )
  const hadCheckedIn = checkinResult.length && checkinResult[0].values.length > 0

  logEvent(db, id, 'withdraw', actorId, actorRole || 'citizen',
    `${reg.name}中途退赛${hadCheckedIn ? '（已签到）' : '（未签到）'}，退款待裁定`,
    { registrationId, withdrawalId, reason, hadCheckedIn, teamId: reg.team_id }
  )

  smartWaitlistPromotion(db, id, activity)

  recalcDepartureList(db, id)

  saveDb()
  res.json({
    success: true,
    data: { registrationId, withdrawalId, status: 'withdrawn', refundStatus: 'pending' }
  })
})

router.post('/:id/withdrawal-adjudicate', async (req: Request, res: Response): Promise<void> => {
  const db = await getDb()
  const { id } = req.params
  const { withdrawalId, refundStatus, refundAmount, adjudicatorId, adjudicatorNote } = req.body

  if (!withdrawalId || !refundStatus || !['approved', 'rejected', 'processed'].includes(refundStatus)) {
    res.status(400).json({ success: false, error: '参数不完整' })
    return
  }

  const wdResult = db.exec('SELECT * FROM withdrawals WHERE id = ? AND activity_id = ?', [withdrawalId, id])
  if (!wdResult.length || !wdResult[0].values.length) {
    res.status(404).json({ success: false, error: '退赛记录不存在' })
    return
  }
  const withdrawal = rowToObject(wdResult[0])

  db.run(
    'UPDATE withdrawals SET refund_status = ?, refund_amount = ?, adjudicator_id = ?, adjudicator_note = ? WHERE id = ?',
    [refundStatus, refundAmount || 0, adjudicatorId, adjudicatorNote || '', withdrawalId]
  )

  if (refundStatus === 'approved' || refundStatus === 'processed') {
    const regResult = db.exec('SELECT user_id FROM registrations WHERE id = ?', [withdrawal.registration_id])
    if (regResult.length && regResult[0].values.length) {
      const userId = regResult[0].values[0][0] as string
      if (refundAmount > 0) {
        db.run('UPDATE users SET points = points + ? WHERE id = ?', [refundAmount, userId])
        db.run(
          `INSERT INTO points_ledger (id, user_id, activity_id, points, reason, frozen, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)`,
          [uuid(), userId, id, refundAmount, '退赛退款', new Date().toISOString()]
        )
      }
      db.run("UPDATE registrations SET status = 'refunded' WHERE id = ?", [withdrawal.registration_id])
    }
  }

  logEvent(db, id, 'withdrawal_adjudicate', adjudicatorId, 'organizer',
    `退赛退款裁定：${refundStatus === 'approved' || refundStatus === 'processed' ? `批准退款${refundAmount || 0}积分` : '驳回退款'}${adjudicatorNote ? '，' + adjudicatorNote : ''}`,
    { withdrawalId, refundStatus, refundAmount, registrationId: withdrawal.registration_id }
  )

  saveDb()
  res.json({
    success: true,
    data: { withdrawalId, refundStatus, refundAmount }
  })
})

router.get('/:id/departure-list', async (req: Request, res: Response): Promise<void> => {
  const db = await getDb()
  const { id } = req.params

  recalcDepartureList(db, id)

  const regs = db.exec(
    `SELECT r.id, r.name, r.phone, r.age, r.status, r.team_id, r.team_name, r.is_team_leader,
       r.liability_signed, r.equipment_confirmed, r.insurance_signed, r.departure_ready,
       r.guardian_name, r.guardian_phone
     FROM registrations r
     WHERE r.activity_id = ? AND r.status IN ('confirmed', 'route_switched')
     ORDER BY r.registered_at ASC`,
    [id]
  )

  const registrations = regs.length && regs[0].values.length
    ? rowsToObjects(regs[0]).map((r: any) => {
        const c = objectToCamel(r)
        c.liabilitySigned = !!c.liabilitySigned
        c.equipmentConfirmed = !!c.equipmentConfirmed
        c.insuranceSigned = !!c.insuranceSigned
        c.isTeamLeader = !!c.isTeamLeader
        return c
      })
    : []

  const teamIds = [...new Set(registrations.filter((r: any) => r.teamId).map((r: any) => r.teamId))]
  let teamDetails: any[] = []
  if (teamIds.length > 0) {
    const placeholders = teamIds.map(() => '?').join(',')
    const teamResult = db.exec(
      `SELECT id, team_name, member_count, can_depart FROM teams WHERE id IN (${placeholders})`,
      teamIds
    )
    teamDetails = teamResult.length && teamResult[0].values.length
      ? rowsToObjects(teamResult[0]).map((t: any) => objectToCamel(t))
      : []
  }

  const readyCount = registrations.filter((r: any) => r.departureReady === 'ready').length
  const blockedCount = registrations.filter((r: any) => r.departureReady === 'blocked').length
  const pendingCount = registrations.filter((r: any) => r.departureReady === 'pending').length

  saveDb()
  res.json({
    success: true,
    data: {
      registrations,
      teams: teamDetails,
      summary: { ready: readyCount, blocked: blockedCount, pending: pendingCount, total: registrations.length }
    }
  })
})

router.get('/:id/event-log', async (req: Request, res: Response): Promise<void> => {
  const db = await getDb()
  const { id } = req.params
  const { eventType } = req.query

  let sql = 'SELECT * FROM event_log WHERE activity_id = ?'
  const params: any[] = [id]

  if (eventType) {
    sql += ' AND event_type = ?'
    params.push(eventType)
  }

  sql += ' ORDER BY created_at DESC'

  const result = db.exec(sql, params)
  const events = result.length && result[0].values.length
    ? rowsToObjects(result[0]).map((e: any) => {
        const c = objectToCamel(e)
        try { c.metadata = JSON.parse(c.metadata) } catch { c.metadata = {} }
        return c
      })
    : []

  res.json({ success: true, data: events })
})

router.get('/:id/volunteer-shifts', async (req: Request, res: Response): Promise<void> => {
  const db = await getDb()
  const { id } = req.params

  const result = db.exec(
    `SELECT vs.*, u.name as volunteer_name, u.phone as volunteer_phone
     FROM volunteer_shifts vs
     JOIN users u ON vs.volunteer_id = u.id
     WHERE vs.activity_id = ?
     ORDER BY vs.start_time ASC`,
    [id]
  )

  const shifts = result.length && result[0].values.length
    ? rowsToObjects(result[0]).map((s: any) => objectToCamel(s))
    : []

  const assigned = shifts.filter(s => s.status === 'assigned').length
  const checkedIn = shifts.filter(s => s.status === 'checked_in').length
  const completed = shifts.filter(s => s.status === 'completed').length
  const absent = shifts.filter(s => s.status === 'absent').length

  res.json({
    success: true,
    data: {
      shifts,
      summary: { assigned, checkedIn, completed, absent, total: shifts.length }
    }
  })
})

router.post('/:id/volunteer-shifts', async (req: Request, res: Response): Promise<void> => {
  const db = await getDb()
  const { id } = req.params
  const { volunteerId, shiftName, startTime, endTime, actorId } = req.body

  if (!volunteerId || !shiftName || !startTime || !endTime) {
    res.status(400).json({ success: false, error: '缺少必填字段' })
    return
  }

  const shiftId = uuid()
  db.run(
    `INSERT INTO volunteer_shifts (id, activity_id, volunteer_id, shift_name, start_time, end_time, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'assigned', ?)`,
    [shiftId, id, volunteerId, shiftName, startTime, endTime, new Date().toISOString()]
  )

  logEvent(db, id, 'volunteer_shift_add', actorId, 'organizer',
    `新增志愿者班次：${shiftName}（${startTime} ~ ${endTime}）`,
    { shiftId, volunteerId, shiftName }
  )

  saveDb()
  res.status(201).json({ success: true, data: { id: shiftId } })
})

router.put('/:id/volunteer-shifts/:shiftId/status', async (req: Request, res: Response): Promise<void> => {
  const db = await getDb()
  const { id, shiftId } = req.params
  const { status, actorId } = req.body

  if (!['assigned', 'checked_in', 'completed', 'absent'].includes(status)) {
    res.status(400).json({ success: false, error: '无效状态' })
    return
  }

  db.run('UPDATE volunteer_shifts SET status = ? WHERE id = ? AND activity_id = ?', [status, shiftId, id])

  const statusLabels: Record<string, string> = {
    assigned: '已分配', checked_in: '已到岗', completed: '已完成', absent: '缺席'
  }

  logEvent(db, id, 'volunteer_shift_status', actorId, 'organizer',
    `志愿者班次状态更新为：${statusLabels[status]}`,
    { shiftId, status }
  )

  saveDb()
  res.json({ success: true, data: { id: shiftId, status } })
})

function recalcDepartureList(db: any, activityId: string) {
  const actResult = db.exec('SELECT age_min FROM activities WHERE id = ?', [activityId])
  const ageMin = actResult.length ? (actResult[0].values[0][0] as number) : 0

  const regs = db.exec(
    `SELECT r.id, r.age, r.liability_signed, r.equipment_confirmed, r.insurance_signed,
       r.guardian_name, r.guardian_phone, r.team_id
     FROM registrations r
     WHERE r.activity_id = ? AND r.status IN ('confirmed', 'route_switched')`,
    [activityId]
  )

  if (!regs.length || !regs[0].values.length) return

  for (const row of regs[0].values) {
    const regId = row[0] as string
    const age = row[1] as number
    const liabilitySigned = row[2] as number
    const equipmentConfirmed = row[3] as number
    const insuranceSigned = row[4] as number
    const guardianName = row[5] as string
    const guardianPhone = row[6] as string
    const teamId = row[7] as string | null

    let blocked = false
    const blockers: string[] = []

    if (!liabilitySigned) { blocked = true; blockers.push('未签署免责声明') }
    if (!equipmentConfirmed) { blocked = true; blockers.push('未确认装备') }
    if (!insuranceSigned) { blocked = true; blockers.push('未签署保险') }

    const isMinor = ageMin > 0 && age < 18
    if (isMinor && (!guardianName || !guardianPhone)) {
      blocked = true
      blockers.push('未成年人缺少监护人信息')
    }

    if (teamId) {
      const activeMembers = db.exec(
        'SELECT COUNT(*) as cnt FROM team_members WHERE team_id = ? AND withdrawn = 0',
        [teamId]
      )
      const memberCount = activeMembers.length ? (activeMembers[0].values[0][0] as number) : 0
      if (memberCount <= 0) {
        blocked = true
        blockers.push('团队已无活跃成员')
      } else if (memberCount === 1) {
        const canDepart = db.exec('SELECT can_depart FROM teams WHERE id = ?', [teamId])
        if (canDepart.length && canDepart[0].values.length && !(canDepart[0].values[0][0] as number)) {
          blockers.push('团队仅剩1人，无法独立成组出发')
        }
      }
    }

    const departureReady = blocked ? 'blocked' : 'ready'
    db.run('UPDATE registrations SET departure_ready = ? WHERE id = ?', [departureReady, regId])

    if (teamId) {
      const teamBlocked = blockers.some(b => b.includes('团队'))
      db.run('UPDATE teams SET can_depart = ? WHERE id = ?', [teamBlocked ? 0 : 1, teamId])
    }
  }
}

function smartWaitlistPromotion(db: any, activityId: string, activity: any) {
  if (!activity) return

  const freedCapacity = 1
  const currentConfirmed = db.exec(
    `SELECT COALESCE(SUM(CASE WHEN team_id IS NULL THEN 1 ELSE 0 END), 0) as ind_cnt FROM registrations WHERE activity_id = ? AND status IN ('confirmed', 'route_switched')`,
    [activityId]
  )
  const individualConfirmed = currentConfirmed.length ? (currentConfirmed[0].values[0][0] as number) : 0
  const teamConfirmedResult = db.exec(
    `SELECT COALESCE(SUM(member_count), 0) as cnt FROM teams WHERE activity_id = ? AND status IN ('confirmed', 'route_switched')`,
    [activityId]
  )
  const teamConfirmed = teamConfirmedResult.length ? (teamConfirmedResult[0].values[0][0] as number) : 0
  const currentTotal = individualConfirmed + teamConfirmed
  const availableSlots = activity.capacity - currentTotal

  if (availableSlots <= 0) return

  const waitlisted = db.exec(
    `SELECT r.id, r.name, r.liability_signed, r.equipment_confirmed, r.insurance_signed,
       r.team_id, r.waitlist_position, t.team_name, t.member_count, t.id as team_table_id
     FROM registrations r
     LEFT JOIN teams t ON r.team_id = t.id
     WHERE r.activity_id = ? AND r.status = 'waitlisted'
     ORDER BY r.waitlist_position ASC`,
    [activityId]
  )

  if (!waitlisted.length || !waitlisted[0].values.length) return

  const candidates = rowsToObjects(waitlisted[0])
  let remainingSlots = availableSlots
  const promoted: any[] = []
  const failed: any[] = []

  for (const candidate of candidates) {
    if (remainingSlots <= 0) break

    const liabilitySigned = candidate.liability_signed as number
    const equipmentConfirmed = candidate.equipment_confirmed as number
    const insuranceSigned = candidate.insurance_signed as number

    const canPromote = liabilitySigned && equipmentConfirmed && insuranceSigned

    if (candidate.team_id && candidate.team_table_id) {
      const memberCount = candidate.member_count as number
      if (remainingSlots < memberCount) {
        failed.push({
          id: candidate.id,
          name: candidate.name,
          teamName: candidate.team_name,
          reason: `团队需${memberCount}个名额，当前仅剩${remainingSlots}个`
        })
        continue
      }

      const teamMembers = db.exec(
        'SELECT id, liability_signed, equipment_confirmed, insurance_signed FROM team_members WHERE team_id = ?',
        [candidate.team_id]
      )
      let allTeamReady = true
      if (teamMembers.length && teamMembers[0].values.length) {
        for (const tm of teamMembers[0].values) {
          if (!tm[1] || !tm[2] || !tm[3]) {
            allTeamReady = false
            break
          }
        }
      }

      if (!canPromote || !allTeamReady) {
        failed.push({
          id: candidate.id,
          name: candidate.name,
          teamName: candidate.team_name,
          reason: '团队中有人未完成装备确认/保险签署/免责声明'
        })
        continue
      }

      const canDepart = memberCount >= 2 ? 1 : 0
      db.run("UPDATE registrations SET status = 'confirmed', waitlist_position = NULL, departure_ready = 'ready' WHERE id = ?", [candidate.id])
      db.run("UPDATE teams SET status = 'confirmed', waitlist_position = NULL, can_depart = ? WHERE id = ?", [canDepart, candidate.team_table_id])
      if (candidate.team_id) {
        db.run("UPDATE registrations SET status = 'confirmed', waitlist_position = NULL WHERE team_id = ?", [candidate.team_id])
      }
      remainingSlots -= memberCount
      promoted.push({ id: candidate.id, name: `${candidate.team_name}团队(${memberCount}人)`, type: 'team' })
    } else {
      if (!canPromote) {
        failed.push({
          id: candidate.id,
          name: candidate.name,
          reason: '未完成装备确认/保险签署/免责声明，候补转正失败'
        })
        continue
      }

      db.run("UPDATE registrations SET status = 'confirmed', waitlist_position = NULL, departure_ready = 'ready' WHERE id = ?", [candidate.id])
      remainingSlots -= 1
      promoted.push({ id: candidate.id, name: candidate.name, type: 'individual' })
    }
  }

  const reorderResult = db.exec(
    `SELECT id FROM registrations WHERE activity_id = ? AND status = 'waitlisted' ORDER BY waitlist_position ASC`,
    [activityId]
  )
  if (reorderResult.length && reorderResult[0].values.length) {
    let pos = 1
    for (const row of reorderResult[0].values) {
      db.run('UPDATE registrations SET waitlist_position = ? WHERE id = ?', [pos++, row[0]])
    }
  }

  if (promoted.length > 0) {
    logEvent(db, activityId, 'waitlist_promote', null, 'system',
      `候补转正：${promoted.map(p => p.name).join('、')}；转正失败：${failed.map(f => `${f.name}(${f.reason})`).join('、') || '无'}`,
      { promoted, failed }
    )
  }

  if (promoted.length > 0) {
    const newConfirmed = db.exec(
      `SELECT COALESCE(SUM(CASE WHEN team_id IS NULL THEN 1 ELSE 0 END), 0) as ind_cnt FROM registrations WHERE activity_id = ? AND status IN ('confirmed', 'route_switched')`,
      [activityId]
    )
    const newInd = newConfirmed.length ? (newConfirmed[0].values[0][0] as number) : 0
    const newTeamResult = db.exec(
      `SELECT COALESCE(SUM(member_count), 0) as cnt FROM teams WHERE activity_id = ? AND status IN ('confirmed', 'route_switched')`,
      [activityId]
    )
    const newTeam = newTeamResult.length ? (newTeamResult[0].values[0][0] as number) : 0
    if (newInd + newTeam >= activity.capacity) {
      db.run("UPDATE activities SET status = 'full' WHERE id = ?", [activityId])
    }
  }
}

export default router
