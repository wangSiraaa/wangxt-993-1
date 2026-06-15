import { Router, type Request, type Response } from 'express'
import { getDb, saveDb, uuid, rowsToObjects, rowToObject, objectToCamel, parseRegistrationRow, parseTeamMemberRow } from '../db.js'

const router = Router()

function registrationToCamel(row: any): any {
  const c = objectToCamel(row)
  c.liabilitySigned = !!c.liabilitySigned
  c.equipmentConfirmed = !!c.equipmentConfirmed
  c.isTeamLeader = !!c.isTeamLeader
  return c
}

function attachTeamMembers(db: any, registrations: any[], activityId: string): any[] {
  const teamIds = [...new Set(registrations.filter(r => r.teamId).map(r => r.teamId))]
  if (teamIds.length === 0) return registrations

  const placeholders = teamIds.map(() => '?').join(',')
  const memberResult = db.exec(
    `SELECT * FROM team_members WHERE team_id IN (${placeholders})`,
    teamIds
  )
  const members = memberResult.length && memberResult[0].values.length
    ? rowsToObjects(memberResult[0]).map(m => parseTeamMemberRow(m))
    : []

  const membersByTeam: Record<string, any[]> = {}
  for (const m of members) {
    if (!membersByTeam[m.teamId]) membersByTeam[m.teamId] = []
    membersByTeam[m.teamId].push(m)
  }

  return registrations.map(r => {
    if (r.teamId && membersByTeam[r.teamId]) {
      r.members = membersByTeam[r.teamId]
    }
    return r
  })
}

router.post('/:id/register', async (req: Request, res: Response): Promise<void> => {
  const db = await getDb()
  const activityId = req.params.id
  const {
    name, phone, age, emergencyContact, emergencyPhone,
    liabilitySigned, equipmentConfirmed, userId,
    isTeam = false, teamName = '', teamMembers = [],
  } = req.body

  if (!name || !phone || !age || !userId) {
    res.status(400).json({ success: false, error: '缺少必填字段' })
    return
  }

  const actResult = db.exec('SELECT * FROM activities WHERE id = ?', [activityId])
  if (!actResult.length || !actResult[0].values.length) {
    res.status(404).json({ success: false, error: '活动不存在' })
    return
  }

  const activity = rowToObject(actResult[0])
  const now = new Date().toISOString()
  let teamId: string | null = null
  let memberCount = 1

  if (isTeam) {
    if (!teamName || teamName.trim() === '') {
      res.status(400).json({ success: false, error: '请填写团队名称' })
      return
    }
    if (!teamMembers || teamMembers.length === 0) {
      res.status(400).json({ success: false, error: '请至少添加1名团队成员' })
      return
    }

    const allMembers = [
      { name, phone, age, emergencyContact, emergencyPhone, liabilitySigned, equipmentConfirmed, isLeader: true },
      ...teamMembers.map((m: any) => ({ ...m, isLeader: false })),
    ]
    memberCount = allMembers.length

    const phonesSeen = new Set<string>()
    for (let i = 0; i < allMembers.length; i++) {
      const m = allMembers[i]
      const label = m.isLeader ? '队长' : `队员${i}`

      if (!m.name || !m.phone || !m.age) {
        res.status(400).json({ success: false, error: `${label}信息不完整，请填写姓名、手机号和年龄` })
        return
      }
      if (m.liabilitySigned !== true) {
        res.status(400).json({ success: false, error: `${label}未签署免责声明，请全部签署` })
        return
      }
      if (m.equipmentConfirmed !== true) {
        res.status(400).json({ success: false, error: `${label}未确认装备要求，请全部确认` })
        return
      }
      if (m.age < activity.age_min || m.age > activity.age_max) {
        res.status(400).json({ success: false, error: `${label}年龄不符合要求，需要${activity.age_min}-${activity.age_max}岁` })
        return
      }
      if (phonesSeen.has(m.phone)) {
        res.status(400).json({ success: false, error: `团队中存在重复手机号：${m.phone}` })
        return
      }
      phonesSeen.add(m.phone)
    }

    const dupPhones = Array.from(phonesSeen)
    const placeholders = dupPhones.map(() => '?').join(',')
    const dupResult = db.exec(
      `SELECT DISTINCT phone FROM registrations WHERE activity_id = ? AND phone IN (${placeholders}) AND status IN ('confirmed', 'waitlisted')`,
      [activityId, ...dupPhones]
    )
    if (dupResult.length && dupResult[0].values.length) {
      const dupList = dupResult[0].values.map(r => r[0]).join('、')
      res.status(400).json({ success: false, error: `以下手机号已报名：${dupList}` })
      return
    }

    const tmDupResult = db.exec(
      `SELECT DISTINCT tm.phone FROM team_members tm
       JOIN registrations r ON tm.registration_id = r.id
       WHERE r.activity_id = ? AND r.status IN ('confirmed', 'waitlisted') AND tm.phone IN (${placeholders})`,
      [activityId, ...dupPhones]
    )
    if (tmDupResult.length && tmDupResult[0].values.length) {
      const dupList = tmDupResult[0].values.map(r => r[0]).join('、')
      res.status(400).json({ success: false, error: `以下手机号已在团队中报名：${dupList}` })
      return
    }
  } else {
    if (liabilitySigned !== true) {
      res.status(400).json({ success: false, error: '请先签署免责声明' })
      return
    }
    if (equipmentConfirmed !== true) {
      res.status(400).json({ success: false, error: '请确认装备要求' })
      return
    }
    if (age < activity.age_min || age > activity.age_max) {
      res.status(400).json({ success: false, error: `年龄不符合要求，需要${activity.age_min}-${activity.age_max}岁` })
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
    const tmDupResult = db.exec(
      `SELECT tm.id FROM team_members tm
       JOIN registrations r ON tm.registration_id = r.id
       WHERE r.activity_id = ? AND r.status IN ('confirmed', 'waitlisted') AND tm.phone = ?`,
      [activityId, phone]
    )
    if (tmDupResult.length && tmDupResult[0].values.length) {
      res.status(400).json({ success: false, error: '该手机号已在其他团队中报名' })
      return
    }
  }

  const cntResult = db.exec(
    `SELECT COUNT(*) as cnt FROM registrations WHERE activity_id = ? AND status = 'confirmed'`,
    [activityId]
  )
  const individualConfirmed = cntResult.length ? (cntResult[0].values[0][0] as number) : 0

  const teamCntResult = db.exec(
    `SELECT COALESCE(SUM(t.member_count), 0) as cnt FROM teams t WHERE t.activity_id = ? AND t.status = 'confirmed'`,
    [activityId]
  )
  const teamConfirmed = teamCntResult.length ? (teamCntResult[0].values[0][0] as number) : 0

  const currentTotal = individualConfirmed + teamConfirmed
  let status: string
  let waitlistPosition: number | null = null

  if (currentTotal + memberCount > activity.capacity) {
    const wlMaxResult = db.exec(
      `SELECT MAX(wp) as max_pos FROM (
         SELECT waitlist_position as wp FROM registrations WHERE activity_id = ? AND status = 'waitlisted'
         UNION ALL
         SELECT waitlist_position as wp FROM teams WHERE activity_id = ? AND status = 'waitlisted'
       )`,
      [activityId, activityId]
    )
    const maxPos = wlMaxResult.length && wlMaxResult[0].values[0][0] ? (wlMaxResult[0].values[0][0] as number) : 0
    status = 'waitlisted'
    waitlistPosition = maxPos + 1
  } else {
    status = 'confirmed'
  }

  const id = uuid()

  if (isTeam) {
    teamId = uuid()
    db.run(
      `INSERT INTO teams (id, activity_id, leader_user_id, team_name, member_count, status, waitlist_position, registered_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [teamId, activityId, userId, teamName.trim(), memberCount, status, waitlistPosition, now]
    )

    db.run(
      `INSERT INTO registrations (id, activity_id, user_id, name, phone, age, emergency_contact, emergency_phone, liability_signed, equipment_confirmed, status, waitlist_position, registered_at, team_id, is_team_leader, team_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [id, activityId, userId, name, phone, age, emergencyContact || '', emergencyPhone || '', liabilitySigned ? 1 : 0, equipmentConfirmed ? 1 : 0, status, waitlistPosition, now, teamId, teamName.trim()]
    )

    db.run(
      `INSERT INTO team_members (id, registration_id, team_id, name, phone, age, emergency_contact, emergency_phone, liability_signed, equipment_confirmed, is_leader, checked_in) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`,
      [uuid(), id, teamId, name, phone, age, emergencyContact || '', emergencyPhone || '', liabilitySigned ? 1 : 0, equipmentConfirmed ? 1 : 0]
    )

    for (const m of teamMembers) {
      const tmId = uuid()
      db.run(
        `INSERT INTO team_members (id, registration_id, team_id, name, phone, age, emergency_contact, emergency_phone, liability_signed, equipment_confirmed, is_leader, checked_in) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
        [tmId, id, teamId, m.name, m.phone, m.age, m.emergencyContact || '', m.emergencyPhone || '', m.liabilitySigned ? 1 : 0, m.equipmentConfirmed ? 1 : 0]
      )
    }
  } else {
    db.run(
      `INSERT INTO registrations (id, activity_id, user_id, name, phone, age, emergency_contact, emergency_phone, liability_signed, equipment_confirmed, status, waitlist_position, registered_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, activityId, userId, name, phone, age, emergencyContact || '', emergencyPhone || '', liabilitySigned ? 1 : 0, equipmentConfirmed ? 1 : 0, status, waitlistPosition, now]
    )
  }

  const newIndResult = db.exec(
    `SELECT COUNT(*) as cnt FROM registrations WHERE activity_id = ? AND status = 'confirmed' AND team_id IS NULL`,
    [activityId]
  )
  const newInd = newIndResult.length ? (newIndResult[0].values[0][0] as number) : 0

  const newTeamCntResult = db.exec(
    `SELECT COALESCE(SUM(t.member_count), 0) as cnt FROM teams t WHERE t.activity_id = ? AND t.status = 'confirmed'`,
    [activityId]
  )
  const newTeam = newTeamCntResult.length ? (newTeamCntResult[0].values[0][0] as number) : 0

  const newTotal = newInd + newTeam
  if (newTotal >= activity.capacity && activity.status === 'open') {
    db.run("UPDATE activities SET status = 'full' WHERE id = ?", [activityId])
  }

  saveDb()

  let message = status === 'confirmed' ? '报名成功' : `报名成功，当前在候补列表中${waitlistPosition ? `，位置：${waitlistPosition}` : ''}`
  if (isTeam) {
    message = status === 'confirmed'
      ? `团队报名成功！共${memberCount}人`
      : `团队报名成功，共${memberCount}人，当前在候补列表中${waitlistPosition ? `，位置：${waitlistPosition}` : ''}`
  }

  const result: any = { id, status, waitlistPosition, message }
  if (isTeam) {
    result.teamId = teamId
    result.memberCount = memberCount
  }

  res.status(201).json({ success: true, data: result })
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

  let cancelledMembers = 0
  const newStatus = activity.status === 'weather_cancelled' ? 'refunded' : 'cancelled'

  if (reg.team_id) {
    const teamResult = db.exec('SELECT * FROM teams WHERE id = ?', [reg.team_id])
    if (teamResult.length && teamResult[0].values.length) {
      const team = rowToObject(teamResult[0])
      cancelledMembers = team.member_count || 0
    }
    db.run('UPDATE teams SET status = ? WHERE id = ?', [newStatus, reg.team_id])
    db.run('DELETE FROM team_members WHERE team_id = ?', [reg.team_id])
  } else {
    cancelledMembers = 1
  }

  db.run('UPDATE registrations SET status = ? WHERE id = ?', [newStatus, regId])

  let promotedRegistration: { id: string; name: string } | null = null
  let promotedMembers = 0

  if (reg.status === 'confirmed') {
    const firstWLReg = db.exec(
      "SELECT id, name, team_id FROM registrations WHERE activity_id = ? AND status = 'waitlisted' AND team_id IS NULL ORDER BY waitlist_position ASC LIMIT 1",
      [reg.activity_id]
    )
    const firstWLTeam = db.exec(
      "SELECT t.id, r.name, t.member_count FROM teams t JOIN registrations r ON t.id = r.team_id WHERE t.activity_id = ? AND t.status = 'waitlisted' ORDER BY t.waitlist_position ASC LIMIT 1",
      [reg.activity_id]
    )

    let regWLPos: number | null = null
    let teamWLPos: number | null = null

    if (firstWLReg.length && firstWLReg[0].values.length) {
      const regResult = db.exec(
        "SELECT waitlist_position FROM registrations WHERE id = ?",
        [firstWLReg[0].values[0][0]]
      )
      regWLPos = regResult.length && regResult[0].values.length ? regResult[0].values[0][0] as number : null
    }
    if (firstWLTeam.length && firstWLTeam[0].values.length) {
      const tId = firstWLTeam[0].values[0][0]
      const tResult = db.exec("SELECT waitlist_position FROM teams WHERE id = ?", [tId])
      teamWLPos = tResult.length && tResult[0].values.length ? tResult[0].values[0][0] as number : null
    }

    const useTeam = teamWLPos !== null && (regWLPos === null || teamWLPos < regWLPos)

    if (useTeam && firstWLTeam.length && firstWLTeam[0].values.length) {
      const wlTeamId = firstWLTeam[0].values[0][0] as string
      const wlName = firstWLTeam[0].values[0][1] as string
      promotedMembers = firstWLTeam[0].values[0][2] as number

      db.run("UPDATE teams SET status = 'confirmed', waitlist_position = NULL WHERE id = ?", [wlTeamId])
      db.run("UPDATE registrations SET status = 'confirmed', waitlist_position = NULL WHERE team_id = ?", [wlTeamId])
      promotedRegistration = { id: wlTeamId, name: `${wlName}团队(${promotedMembers}人)` }
    } else if (!useTeam && firstWLReg.length && firstWLReg[0].values.length) {
      const wlId = firstWLReg[0].values[0][0] as string
      const wlName = firstWLReg[0].values[0][1] as string
      db.run("UPDATE registrations SET status = 'confirmed', waitlist_position = NULL WHERE id = ?", [wlId])
      promotedRegistration = { id: wlId, name: wlName }
      promotedMembers = 1
    }

    const indCnt = db.exec(
      `SELECT COUNT(*) as cnt FROM registrations WHERE activity_id = ? AND status = 'confirmed' AND team_id IS NULL`,
      [reg.activity_id]
    )
    const indTotal = indCnt.length ? (indCnt[0].values[0][0] as number) : 0
    const teamCnt = db.exec(
      `SELECT COALESCE(SUM(t.member_count), 0) as cnt FROM teams t WHERE t.activity_id = ? AND t.status = 'confirmed'`,
      [reg.activity_id]
    )
    const teamTotal = teamCnt.length ? (teamCnt[0].values[0][0] as number) : 0
    if (activity.status === 'full' && indTotal + teamTotal < activity.capacity) {
      db.run("UPDATE activities SET status = 'open' WHERE id = ?", [reg.activity_id])
    }
  }

  saveDb()

  const response: any = { cancelled: true, promotedRegistration }
  if (cancelledMembers > 1) {
    response.cancelledMembers = cancelledMembers
  }

  res.json({ success: true, data: response })
})

router.get('/activity/:id', async (req: Request, res: Response): Promise<void> => {
  const db = await getDb()
  const { id } = req.params

  const result = db.exec(
    'SELECT * FROM registrations WHERE activity_id = ? ORDER BY registered_at ASC',
    [id]
  )

  let rows = result.length && result[0].values.length
    ? rowsToObjects(result[0]).map(r => registrationToCamel(r))
    : []

  rows = attachTeamMembers(db, rows, id)

  res.json({ success: true, data: rows })
})

router.get('/user/:phone', async (req: Request, res: Response): Promise<void> => {
  const db = await getDb()
  const { phone } = req.params

  const result = db.exec(
    `SELECT r.id, r.activity_id, r.user_id, r.name, r.phone, r.age, r.emergency_contact, r.emergency_phone,
       r.liability_signed, r.equipment_confirmed, r.status, r.waitlist_position, r.registered_at,
       r.team_id, r.is_team_leader, r.team_name,
       a.name as activity_name, a.date as activity_date, a.status as activity_status
     FROM registrations r
     JOIN activities a ON r.activity_id = a.id
     WHERE r.phone = ?
     ORDER BY r.registered_at DESC`,
    [phone]
  )

  let rows = result.length && result[0].values.length
    ? rowsToObjects(result[0]).map(r => {
        const c = registrationToCamel(r)
        c.activityName = r.activity_name
        c.activityDate = r.activity_date
        c.activityStatus = r.activity_status
        return c
      })
    : []

  const activityIds = [...new Set(rows.map(r => r.activityId))]
  for (const aid of activityIds) {
    rows = attachTeamMembers(db, rows, aid)
  }

  res.json({ success: true, data: rows })
})

export default router
