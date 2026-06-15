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

  const regResult1 = db.exec('SELECT team_id FROM registrations WHERE id = ?', [registrationId]);
  let teamId: string | null = null;
  if (regResult1.length && regResult1[0].values.length) {
    teamId = regResult1[0].values[0][0] as string;
  }

  db.run(
    `INSERT INTO checkins (id, activity_id, registration_id, volunteer_id, is_exception, note, checked_in_at, team_member_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, activityId, registrationId, volunteerId, isException ? 1 : 0, note || '', now, null]
  )

  if (teamId) {
    const memberName = req.body.memberName || null;
    if (memberName) {
      db.run(
        'UPDATE team_members SET checked_in = 1 WHERE team_id = ? AND name = ?',
        [teamId, memberName]
      );
    }
  }

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
    "SELECT COUNT(*) as cnt FROM registrations WHERE activity_id = ? AND status = 'confirmed' AND team_id IS NULL",
    [id]
  )
  const individualCount = regTotal.length ? (regTotal[0].values[0][0] as number) : 0

  const teamTotal = db.exec(
    "SELECT COALESCE(SUM(member_count), 0) as cnt, COUNT(*) as team_cnt FROM teams WHERE activity_id = ? AND status = 'confirmed'",
    [id]
  )
  let teamMemberTotal = 0;
  let teamCount = 0;
  if (teamTotal.length && teamTotal[0].values.length) {
    teamMemberTotal = teamTotal[0].values[0][0] as number;
    teamCount = teamTotal[0].values[0][1] as number;
  }
  const total = individualCount + teamMemberTotal;

  const checkedIndResult = db.exec(
    'SELECT COUNT(DISTINCT registration_id) as cnt FROM checkins WHERE activity_id = ? AND registration_id IN (SELECT id FROM registrations WHERE team_id IS NULL)',
    [id]
  )
  const checkedIndividual = checkedIndResult.length ? (checkedIndResult[0].values[0][0] as number) : 0

  const checkedTeamResult = db.exec(
    'SELECT COALESCE(SUM(CASE WHEN tm.checked_in = 1 THEN 1 ELSE 0 END), 0) as cnt FROM team_members tm JOIN registrations r ON tm.registration_id = r.id WHERE r.activity_id = ? AND r.status = ?',
    [id, 'confirmed']
  );
  const checkedTeamMembers = checkedTeamResult.length ? (checkedTeamResult[0].values[0][0] as number) : 0;
  const checkedIn = checkedIndividual + checkedTeamMembers;

  const excResult = db.exec(
    'SELECT COUNT(*) as cnt FROM checkins WHERE activity_id = ? AND is_exception = 1',
    [id]
  )
  const exceptions = excResult.length ? (excResult[0].values[0][0] as number) : 0

  const notCheckedIn = total - checkedIn
  const checkinRate = total > 0 ? checkedIn / total : 0

  res.json({
    success: true,
    data: {
      total, checkedIn, notCheckedIn, exceptions, checkinRate,
      teamCount, teamCheckedIn: checkedTeamMembers
    },
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
