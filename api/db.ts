import initSqlJs, { type Database } from 'sql.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DATA_DIR = path.join(__dirname, 'data')
const DB_FILE = path.join(DATA_DIR, 'greenway.db')

let dbInstance: Database | null = null
let dbReady: Promise<Database> | null = null

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

function loadFromDisk(): Uint8Array | null {
  if (fs.existsSync(DB_FILE)) {
    return fs.readFileSync(DB_FILE)
  }
  return null
}

export function saveDb(): void {
  if (!dbInstance) return
  ensureDataDir()
  const data = dbInstance.export()
  const buffer = Buffer.from(data)
  fs.writeFileSync(DB_FILE, buffer)
}

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance
  if (!dbReady) {
    dbReady = initDatabase()
  }
  return dbReady
}

async function initDatabase(): Promise<Database> {
  const SQL = await initSqlJs()
  const saved = loadFromDisk()
  dbInstance = saved ? new SQL.Database(saved) : new SQL.Database()

  createTables(dbInstance)
  if (!saved) {
    seedData(dbInstance)
    saveDb()
  }

  console.log('Database initialized')
  return dbInstance
}

function createTables(db: Database) {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('citizen','organizer','volunteer')),
    points INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('hike','bike')),
    date TEXT NOT NULL,
    location TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    capacity INTEGER NOT NULL,
    age_min INTEGER NOT NULL DEFAULT 0,
    age_max INTEGER NOT NULL DEFAULT 100,
    equipment_requirements TEXT NOT NULL DEFAULT '[]',
    refund_rule TEXT NOT NULL DEFAULT '',
    points_reward INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','full','ongoing','ended','weather_cancelled')),
    weather_risk_level TEXT NOT NULL DEFAULT 'low' CHECK(weather_risk_level IN ('low','medium','high')),
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS route_segments (
    id TEXT PRIMARY KEY,
    activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    distance REAL NOT NULL DEFAULT 0,
    capacity INTEGER NOT NULL DEFAULT 0,
    supply_info TEXT NOT NULL DEFAULT '',
    risk_level TEXT NOT NULL DEFAULT 'low' CHECK(risk_level IN ('low','medium','high')),
    sort_order INTEGER NOT NULL DEFAULT 0
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS registrations (
    id TEXT PRIMARY KEY,
    activity_id TEXT NOT NULL REFERENCES activities(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    age INTEGER NOT NULL,
    emergency_contact TEXT NOT NULL DEFAULT '',
    emergency_phone TEXT NOT NULL DEFAULT '',
    liability_signed INTEGER NOT NULL DEFAULT 0,
    equipment_confirmed INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed','waitlisted','cancelled','refunded')),
    waitlist_position INTEGER,
    registered_at TEXT NOT NULL DEFAULT (datetime('now')),
    team_id TEXT,
    is_team_leader INTEGER NOT NULL DEFAULT 0,
    team_name TEXT
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    activity_id TEXT NOT NULL REFERENCES activities(id),
    leader_user_id TEXT NOT NULL REFERENCES users(id),
    team_name TEXT NOT NULL,
    member_count INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed','waitlisted','cancelled','refunded')),
    waitlist_position INTEGER,
    registered_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS team_members (
    id TEXT PRIMARY KEY,
    registration_id TEXT NOT NULL REFERENCES registrations(id),
    team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    age INTEGER NOT NULL,
    emergency_contact TEXT NOT NULL DEFAULT '',
    emergency_phone TEXT NOT NULL DEFAULT '',
    liability_signed INTEGER NOT NULL DEFAULT 0,
    equipment_confirmed INTEGER NOT NULL DEFAULT 0,
    is_leader INTEGER NOT NULL DEFAULT 0,
    checked_in INTEGER NOT NULL DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS checkins (
    id TEXT PRIMARY KEY,
    activity_id TEXT NOT NULL REFERENCES activities(id),
    registration_id TEXT NOT NULL REFERENCES registrations(id),
    volunteer_id TEXT NOT NULL REFERENCES users(id),
    is_exception INTEGER NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    checked_in_at TEXT NOT NULL DEFAULT (datetime('now')),
    team_member_id TEXT REFERENCES team_members(id)
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS points_ledger (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    activity_id TEXT NOT NULL REFERENCES activities(id),
    points INTEGER NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`)
}

function seedData(db: Database) {
  const now = new Date().toISOString()

  const orgId = uuid()
  const volId = uuid()
  const citizenId = uuid()

  db.run(`INSERT INTO users (id,phone,name,role,points,created_at) VALUES (?,?,?,?,?,?)`,
    [orgId, '13800000001', '张组织', 'organizer', 100, now])
  db.run(`INSERT INTO users (id,phone,name,role,points,created_at) VALUES (?,?,?,?,?,?)`,
    [volId, '13800000002', '李志愿', 'volunteer', 50, now])
  db.run(`INSERT INTO users (id,phone,name,role,points,created_at) VALUES (?,?,?,?,?,?)`,
    [citizenId, '13800000003', '王市民', 'citizen', 20, now])

  const act1 = uuid()
  const act2 = uuid()

  db.run(`INSERT INTO activities (id,name,type,date,location,description,capacity,age_min,age_max,equipment_requirements,refund_rule,points_reward,status,weather_risk_level,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [act1, '春日滨江徒步', 'hike', '2026-06-20', '滨江绿道', '沿滨江绿道徒步，欣赏春日美景，全程约7.5公里。适合各年龄段市民参加。', 3, 16, 65, JSON.stringify(['运动鞋', '防晒帽', '饮用水']), '活动前48小时可全额退款', 20, 'open', 'low', orgId, now])

  db.run(`INSERT INTO activities (id,name,type,date,location,description,capacity,age_min,age_max,equipment_requirements,refund_rule,points_reward,status,weather_risk_level,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [act2, '环湖骑行挑战', 'bike', '2026-06-25', '西湖绿道', '环西湖绿道骑行挑战赛，全程15公里。需自备自行车及安全装备。', 20, 18, 55, JSON.stringify(['自行车', '头盔', '护膝']), '活动前72小时可全额退款', 30, 'open', 'medium', orgId, now])

  const segs = [
    { id: uuid(), aid: act1, name: '滨江公园出发段', dist: 2.5, cap: 50, supply: '补给站A', risk: 'low', ord: 1 },
    { id: uuid(), aid: act1, name: '江畔栈道中段', dist: 3.0, cap: 40, supply: '补给站B', risk: 'medium', ord: 2 },
    { id: uuid(), aid: act1, name: '观景台终点段', dist: 2.0, cap: 50, supply: '', risk: 'low', ord: 3 },
    { id: uuid(), aid: act2, name: '湖滨起点段', dist: 5.0, cap: 30, supply: '维修点', risk: 'low', ord: 1 },
    { id: uuid(), aid: act2, name: '山路爬坡段', dist: 4.0, cap: 25, supply: '补给站C', risk: 'high', ord: 2 },
    { id: uuid(), aid: act2, name: '环湖冲刺段', dist: 6.0, cap: 30, supply: '终点补给', risk: 'medium', ord: 3 },
  ]

  for (const s of segs) {
    db.run(`INSERT INTO route_segments (id,activity_id,name,distance,capacity,supply_info,risk_level,sort_order) VALUES (?,?,?,?,?,?,?,?)`,
      [s.id, s.aid, s.name, s.dist, s.cap, s.supply, s.risk, s.ord])
  }
}

export function uuid(): string {
  return crypto.randomUUID()
}

export function rowsToObjects(result: { columns: string[]; values: any[][] }): any[] {
  return result.values.map(v => {
    const obj: any = {}
    result.columns.forEach((c, i) => { obj[c] = v[i] })
    return obj
  })
}

export function rowToObject(result: { columns: string[]; values: any[][] } | null): any | null {
  if (!result || !result.values.length) return null
  const obj: any = {}
  result.columns.forEach((c, i) => { obj[c] = result.values[0][i] })
  return obj
}

export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

export function objectToCamel(obj: any): any {
  if (!obj) return obj
  const result: any = {}
  for (const key of Object.keys(obj)) {
    result[toCamelCase(key)] = obj[key]
  }
  return result
}

export function parseActivityRow(row: any): any {
  if (!row) return null
  const camel = objectToCamel(row)
  if (typeof camel.equipmentRequirements === 'string') {
    try { camel.equipmentRequirements = JSON.parse(camel.equipmentRequirements) } catch { camel.equipmentRequirements = [] }
  }
  return camel
}

export function parseRegistrationRow(row: any): any {
  if (!row) return null
  const c = objectToCamel(row)
  c.liabilitySigned = !!c.liabilitySigned
  c.equipmentConfirmed = !!c.equipmentConfirmed
  c.isTeamLeader = !!c.isTeamLeader
  return c
}

export function parseTeamMemberRow(row: any): any {
  if (!row) return null
  const c = objectToCamel(row)
  c.liabilitySigned = !!c.liabilitySigned
  c.equipmentConfirmed = !!c.equipmentConfirmed
  c.isLeader = !!c.isLeader
  c.checkedIn = !!c.checkedIn
  return c
}
