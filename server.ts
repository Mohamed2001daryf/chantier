import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const db = new Database("chantier.db");

// Initialize Database Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    zone TEXT NOT NULL,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS floors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    block_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    order_number INTEGER NOT NULL,
    FOREIGN KEY (block_id) REFERENCES blocks (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS vertical_elements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    block_id INTEGER NOT NULL,
    floor_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    axes TEXT,
    ferraillage_status TEXT DEFAULT 'Non commencé',
    coffrage_status TEXT DEFAULT 'Non commencé',
    coulage_status TEXT DEFAULT 'Non commencé',
    FOREIGN KEY (block_id) REFERENCES blocks (id) ON DELETE CASCADE,
    FOREIGN KEY (floor_id) REFERENCES floors (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS slabs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    block_id INTEGER NOT NULL,
    floor_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    axes TEXT,
    surface REAL,
    start_date TEXT,
    end_date TEXT,
    status TEXT DEFAULT 'Non commencé',
    coffrage_status TEXT DEFAULT 'Non commencé',
    ferraillage_inf_status TEXT DEFAULT 'Non commencé',
    pose_gaine_status TEXT DEFAULT 'Non commencé',
    pose_cable_status TEXT DEFAULT 'Non commencé',
    renforcement_status TEXT DEFAULT 'Non commencé',
    coulage_status TEXT DEFAULT 'Non commencé',
    FOREIGN KEY (block_id) REFERENCES blocks (id) ON DELETE CASCADE,
    FOREIGN KEY (floor_id) REFERENCES floors (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    block_id INTEGER,
    floor_id INTEGER,
    element TEXT,
    description TEXT,
    start_date TEXT,
    end_date TEXT,
    duration INTEGER,
    status TEXT DEFAULT 'Non commencé',
    element_id INTEGER,
    element_type TEXT,
    slab_id INTEGER,
    axes TEXT,
    surface REAL,
    FOREIGN KEY (block_id) REFERENCES blocks (id) ON DELETE CASCADE,
    FOREIGN KEY (floor_id) REFERENCES floors (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    speciality TEXT NOT NULL,
    block_id INTEGER,
    workers INTEGER DEFAULT 0,
    FOREIGN KEY (block_id) REFERENCES blocks (id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS productivity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    block_id INTEGER,
    team_id INTEGER,
    work_type TEXT,
    workers_count INTEGER,
    quantity_realized REAL,
    date TEXT,
    FOREIGN KEY (block_id) REFERENCES blocks (id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE
  );
`);

// Migration: Add element_id to tasks if it doesn't exist
try {
  db.prepare("ALTER TABLE tasks ADD COLUMN element_id INTEGER").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE tasks ADD COLUMN element_type TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE tasks ADD COLUMN slab_id INTEGER").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE slabs ADD COLUMN status TEXT DEFAULT 'Non commencé'").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE slabs ADD COLUMN start_date TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE slabs ADD COLUMN end_date TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE tasks ADD COLUMN axes TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE tasks ADD COLUMN surface REAL").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE tasks ADD COLUMN team_id INTEGER").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE productivity ADD COLUMN task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL").run();
} catch (e) {}

// Seed initial data if empty
const blockCount = db.prepare("SELECT COUNT(*) as count FROM blocks").get() as { count: number };
if (blockCount.count === 0) {
  const insertBlock = db.prepare("INSERT INTO blocks (name, zone, description) VALUES (?, ?, ?)");
  insertBlock.run("Bloc A", "Zone Logement", "Immeuble d'habitation");
  insertBlock.run("Bloc B", "Zone Logement", "Immeuble d'habitation");
  insertBlock.run("Bloc C", "Zone Bureau", "Bureaux administratifs");
  
  const blocks = db.prepare("SELECT id FROM blocks").all() as { id: number }[];
  const insertFloor = db.prepare("INSERT INTO floors (block_id, name, order_number) VALUES (?, ?, ?)");
  
  blocks.forEach(block => {
    insertFloor.run(block.id, "Sous-sol", -1);
    insertFloor.run(block.id, "RDC", 0);
    insertFloor.run(block.id, "R+1", 1);
    insertFloor.run(block.id, "R+2", 2);
  });

  const insertTeam = db.prepare("INSERT INTO teams (name, speciality, block_id, workers) VALUES (?, ?, ?, ?)");
  insertTeam.run("Équipe Ferraillage Alpha", "Ferraillage", blocks[0].id, 12);
  insertTeam.run("Équipe Coffrage Beta", "Coffrage", blocks[0].id, 15);
  insertTeam.run("Équipe Béton Gamma", "Béton", blocks[1].id, 8);
}

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // API Routes
  app.get("/api/blocks", (req, res) => {
    const blocks = db.prepare("SELECT * FROM blocks").all();
    res.json(blocks);
  });

  app.post("/api/blocks", (req, res) => {
    const { name, zone, description } = req.body;
    const info = db.prepare("INSERT INTO blocks (name, zone, description) VALUES (?, ?, ?)").run(name, zone, description);
    res.json({ id: info.lastInsertRowid });
  });

  app.put("/api/blocks/:id", (req, res) => {
    const { name, zone, description } = req.body;
    db.prepare("UPDATE blocks SET name = ?, zone = ?, description = ? WHERE id = ?").run(name, zone, description, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/blocks/:id", (req, res) => {
    db.prepare("DELETE FROM blocks WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/floors", (req, res) => {
    const floors = db.prepare(`
      SELECT floors.*, blocks.name as block_name 
      FROM floors 
      JOIN blocks ON floors.block_id = blocks.id
      ORDER BY blocks.name, floors.order_number
    `).all();
    res.json(floors);
  });

  app.post("/api/floors", (req, res) => {
    const { block_id, name, order_number } = req.body;
    const info = db.prepare("INSERT INTO floors (block_id, name, order_number) VALUES (?, ?, ?)").run(block_id, name, order_number);
    res.json({ id: info.lastInsertRowid });
  });

  app.delete("/api/floors/:id", (req, res) => {
    db.prepare("DELETE FROM floors WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/vertical-elements", (req, res) => {
    const elements = db.prepare(`
      SELECT ve.*, b.name as block_name, f.name as floor_name
      FROM vertical_elements ve
      JOIN blocks b ON ve.block_id = b.id
      JOIN floors f ON ve.floor_id = f.id
    `).all();
    res.json(elements);
  });

  app.post("/api/vertical-elements", (req, res) => {
    const { block_id, floor_id, type, name, axes, start_date, end_date } = req.body;
    const info = db.prepare("INSERT INTO vertical_elements (block_id, floor_id, type, name, axes) VALUES (?, ?, ?, ?, ?)").run(
      block_id ?? null, 
      floor_id ?? null, 
      type ?? null, 
      name ?? null, 
      axes ?? null
    );
    const elementId = info.lastInsertRowid;

    // Automatically create planning task
    const startDate = start_date || new Date().toISOString().split('T')[0];
    const endDate = end_date || new Date(new Date().setDate(new Date().getDate() + 5)).toISOString().split('T')[0];
    
    // Calculate duration
    const start = new Date(startDate);
    const end = new Date(endDate);
    const duration = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

    db.prepare(`
      INSERT INTO tasks (block_id, floor_id, element, description, start_date, end_date, duration, status, element_id, element_type, axes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(block_id, floor_id, name, name, startDate, endDate, duration, 'Non commencé', elementId, type, axes);

    res.json({ id: elementId });
  });

  app.delete("/api/vertical-elements/:id", (req, res) => {
    const id = req.params.id;
    db.prepare("DELETE FROM vertical_elements WHERE id = ?").run(id);
    db.prepare("DELETE FROM tasks WHERE element_id = ? AND element_type IN ('Poteau', 'Voile', 'Voile périphérique')").run(id);
    res.json({ success: true });
  });

  app.patch("/api/vertical-elements/:id", (req, res) => {
    if (Object.keys(req.body).length === 0) return res.json({ success: true });
    const fields = Object.keys(req.body).map(key => `${key} = ?`).join(", ");
    const values = [...Object.values(req.body), req.params.id];
    db.prepare(`UPDATE vertical_elements SET ${fields} WHERE id = ?`).run(...values);

    // Sync status with task
    if (req.body.coulage_status === 'Terminé') {
      db.prepare("UPDATE tasks SET status = 'Terminé' WHERE element_id = ? AND element_type IN ('Poteau', 'Voile', 'Voile périphérique')").run(req.params.id);
    } else if (req.body.ferraillage_status === 'En cours' || req.body.coffrage_status === 'En cours' || req.body.coulage_status === 'En cours') {
      db.prepare("UPDATE tasks SET status = 'En cours' WHERE element_id = ? AND element_type IN ('Poteau', 'Voile', 'Voile périphérique')").run(req.params.id);
    }

    res.json({ success: true });
  });

  app.get("/api/slabs", (req, res) => {
    const slabs = db.prepare(`
      SELECT s.*, b.name as block_name, f.name as floor_name
      FROM slabs s
      JOIN blocks b ON s.block_id = b.id
      JOIN floors f ON s.floor_id = f.id
    `).all();
    res.json(slabs);
  });

  app.post("/api/slabs", (req, res) => {
    const { block_id, floor_id, name, axes, surface, start_date, end_date } = req.body;
    const info = db.prepare(`
      INSERT INTO slabs (block_id, floor_id, name, axes, surface, start_date, end_date, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      block_id ?? null, 
      floor_id ?? null, 
      name ?? null, 
      axes ?? null, 
      surface ?? 0, 
      start_date ?? null, 
      end_date ?? null, 
      'Non commencé'
    );
    const slabId = info.lastInsertRowid;

    // Automatically create planning task
    const startDate = start_date || new Date().toISOString().split('T')[0];
    const endDate = end_date || new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0];
    
    // Calculate duration
    const start = new Date(startDate);
    const end = new Date(endDate);
    const duration = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

    db.prepare(`
      INSERT INTO tasks (block_id, floor_id, element, description, start_date, end_date, duration, status, element_type, slab_id, axes, surface)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(block_id, floor_id, name, name, startDate, endDate, duration, 'Non commencé', 'Dalle', slabId, axes, surface);

    res.json({ id: slabId });
  });

  app.patch("/api/slabs/:id", (req, res) => {
    if (Object.keys(req.body).length === 0) return res.json({ success: true });
    const fields = Object.keys(req.body).map(key => `${key} = ?`).join(", ");
    const values = [...Object.values(req.body), req.params.id];
    db.prepare(`UPDATE slabs SET ${fields} WHERE id = ?`).run(...values);

    // Sync status with task
    if (req.body.coulage_status === 'Terminé') {
      db.prepare("UPDATE tasks SET status = 'Terminé' WHERE slab_id = ?").run(req.params.id);
      db.prepare("UPDATE slabs SET status = 'Terminé' WHERE id = ?").run(req.params.id);
    } else if (Object.values(req.body).some(v => v === 'En cours')) {
      db.prepare("UPDATE tasks SET status = 'En cours' WHERE slab_id = ?").run(req.params.id);
      db.prepare("UPDATE slabs SET status = 'En cours' WHERE id = ?").run(req.params.id);
    }

    res.json({ success: true });
  });

  app.delete("/api/slabs/:id", (req, res) => {
    const id = req.params.id;
    db.prepare("DELETE FROM slabs WHERE id = ?").run(id);
    db.prepare("DELETE FROM tasks WHERE slab_id = ?").run(id);
    res.json({ success: true });
  });

  app.get("/api/tasks", (req, res) => {
    const tasks = db.prepare(`
      SELECT t.*, b.name as block_name, f.name as floor_name, tm.name as team_name
      FROM tasks t
      LEFT JOIN blocks b ON t.block_id = b.id
      LEFT JOIN floors f ON t.floor_id = f.id
      LEFT JOIN teams tm ON t.team_id = tm.id
      ORDER BY t.start_date
    `).all();
    res.json(tasks);
  });

  app.post("/api/tasks", (req, res) => {
    const { block_id, floor_id, element, description, start_date, end_date, duration, status, element_type, axes, surface } = req.body;
    
    let element_id = null;
    let slab_id = null;

    // Create structural element if type is specified
    if (element_type === 'Dalle') {
      // Ensure block_id and floor_id are not null for slabs (required by schema)
      let finalBlockId = block_id;
      let finalFloorId = floor_id;

      if (!finalBlockId || !finalFloorId) {
        const defaultBlock = db.prepare("SELECT id FROM blocks ORDER BY id LIMIT 1").get() as { id: number } | undefined;
        if (defaultBlock) {
          finalBlockId = finalBlockId || defaultBlock.id;
          const defaultFloor = db.prepare("SELECT id FROM floors WHERE block_id = ? ORDER BY id LIMIT 1").get(finalBlockId) as { id: number } | undefined;
          if (defaultFloor) {
            finalFloorId = finalFloorId || defaultFloor.id;
          }
        }
      }

      if (finalBlockId && finalFloorId) {
        const slabInfo = db.prepare(`
          INSERT INTO slabs (block_id, floor_id, name, axes, surface, start_date, end_date, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          finalBlockId, 
          finalFloorId, 
          element, 
          axes, 
          surface ? parseFloat(surface.toString()) : 0, 
          start_date, 
          end_date, 
          status || 'Non commencé'
        );
        slab_id = slabInfo.lastInsertRowid;
      }
    } else if (['Poteau', 'Voile', 'Voile périphérique'].includes(element_type)) {
      const veInfo = db.prepare(`
        INSERT INTO vertical_elements (block_id, floor_id, type, name, axes)
        VALUES (?, ?, ?, ?, ?)
      `).run(block_id, floor_id, element_type, element, axes);
      element_id = veInfo.lastInsertRowid;
    }

    const info = db.prepare(`
      INSERT INTO tasks (block_id, floor_id, element, description, start_date, end_date, duration, status, element_id, element_type, slab_id, axes, surface, team_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      block_id ?? null, 
      floor_id ?? null, 
      element ?? null, 
      (description || element) ?? null, 
      start_date ?? null, 
      end_date ?? null, 
      duration ?? 0, 
      (status || 'Non commencé') ?? null, 
      element_id ?? null, 
      element_type ?? null, 
      slab_id ?? null, 
      axes ?? null, 
      surface ?? 0,
      req.body.team_id ?? null
    );
    
    res.json({ id: info.lastInsertRowid, element_id, slab_id });
  });

  app.put("/api/tasks/:id", (req, res) => {
    const { block_id, floor_id, element, description, start_date, end_date, duration, status, element_type, axes, surface } = req.body;
    const id = req.params.id;

    // Get current task to find linked elements
    const task = db.prepare("SELECT element_id, slab_id, element_type FROM tasks WHERE id = ?").get(id) as any;

    db.prepare(`
      UPDATE tasks 
      SET block_id = ?, floor_id = ?, element = ?, description = ?, start_date = ?, end_date = ?, duration = ?, status = ?, element_type = ?, axes = ?, surface = ?, team_id = ?
      WHERE id = ?
    `).run(
      block_id ?? null, 
      floor_id ?? null, 
      element ?? null, 
      description ?? null, 
      start_date ?? null, 
      end_date ?? null, 
      duration ?? 0, 
      status ?? null, 
      element_type ?? null, 
      axes ?? null, 
      surface ?? 0, 
      req.body.team_id ?? null,
      id
    );

    // Sync with linked elements
    if (task) {
      if (task.slab_id) {
        db.prepare(`
          UPDATE slabs 
          SET block_id = ?, floor_id = ?, name = ?, axes = ?, surface = ?, start_date = ?, end_date = ?, status = ?
          WHERE id = ?
        `).run(block_id, floor_id, element, axes, surface, start_date, end_date, status, task.slab_id);
      } else if (task.element_id && ['Poteau', 'Voile', 'Voile périphérique'].includes(task.element_type)) {
        db.prepare(`
          UPDATE vertical_elements 
          SET block_id = ?, floor_id = ?, name = ?, axes = ?, type = ?
          WHERE id = ?
        `).run(block_id, floor_id, element, axes, element_type, task.element_id);
      }
    }

    res.json({ success: true });
  });

  app.delete("/api/tasks/:id", (req, res) => {
    const task = db.prepare("SELECT element_id, slab_id, element_type FROM tasks WHERE id = ?").get(req.params.id) as any;
    if (task) {
      if (task.slab_id) {
        db.prepare("DELETE FROM slabs WHERE id = ?").run(task.slab_id);
      } else if (task.element_id && ['Poteau', 'Voile', 'Voile périphérique'].includes(task.element_type)) {
        db.prepare("DELETE FROM vertical_elements WHERE id = ?").run(task.element_id);
      }
    }
    db.prepare("DELETE FROM tasks WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.post("/api/tasks/bulk-delete", (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "IDs invalides" });
    }
    const placeholders = ids.map(() => "?").join(",");
    db.prepare(`DELETE FROM tasks WHERE id IN (${placeholders})`).run(...ids);
    res.json({ success: true });
  });

  app.get("/api/teams", (req, res) => {
    const teams = db.prepare(`
      SELECT t.*, b.name as block_name
      FROM teams t
      LEFT JOIN blocks b ON t.block_id = b.id
    `).all();
    res.json(teams);
  });

  app.post("/api/teams", (req, res) => {
    const { name, speciality, block_id, workers } = req.body;
    const info = db.prepare("INSERT INTO teams (name, speciality, block_id, workers) VALUES (?, ?, ?, ?)").run(name, speciality, block_id, workers);
    res.json({ id: info.lastInsertRowid });
  });

  app.put("/api/teams/:id", (req, res) => {
    const { name, speciality, block_id, workers } = req.body;
    db.prepare("UPDATE teams SET name = ?, speciality = ?, block_id = ?, workers = ? WHERE id = ?")
      .run(name, speciality, block_id ?? null, workers ?? 0, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/teams/:id", (req, res) => {
    db.prepare("DELETE FROM teams WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/productivity", (req, res) => {
    const prod = db.prepare(`
      SELECT p.*, b.name as block_name, tm.name as team_name, tk.element as task_name
      FROM productivity p
      JOIN blocks b ON p.block_id = b.id
      JOIN teams tm ON p.team_id = tm.id
      LEFT JOIN tasks tk ON p.task_id = tk.id
    `).all();
    res.json(prod);
  });

  app.post("/api/productivity", (req, res) => {
    const { block_id, team_id, task_id, work_type, workers_count, quantity_realized, date } = req.body;
    const info = db.prepare("INSERT INTO productivity (block_id, team_id, task_id, work_type, workers_count, quantity_realized, date) VALUES (?, ?, ?, ?, ?, ?, ?)").run(block_id, team_id, task_id ?? null, work_type, workers_count, quantity_realized, date);
    res.json({ id: info.lastInsertRowid });
  });

  app.get("/api/dashboard-stats", (req, res) => {
    const totalTasks = db.prepare("SELECT COUNT(*) as count FROM tasks").get() as { count: number };
    const finishedTasks = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'Terminé'").get() as { count: number };
    const delayedTasks = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status != 'Terminé' AND end_date < date('now')").get() as { count: number };
    const activeWorkers = db.prepare("SELECT SUM(workers) as count FROM teams").get() as { count: number };
    
    const totalBlocks = db.prepare("SELECT COUNT(*) as count FROM blocks").get() as { count: number };
    const totalFloors = db.prepare("SELECT COUNT(*) as count FROM floors").get() as { count: number };
    const totalElements = db.prepare("SELECT (SELECT COUNT(*) FROM vertical_elements) + (SELECT COUNT(*) FROM slabs) as count").get() as { count: number };
    
    const taskStatusCounts = db.prepare("SELECT status, COUNT(*) as count FROM tasks GROUP BY status").all();
    
    const progressByBlock = db.prepare(`
      SELECT b.name, 
             COALESCE(CAST(SUM(CASE WHEN t.status = 'Terminé' THEN 1 ELSE 0 END) AS FLOAT) / NULLIF(COUNT(t.id), 0) * 100, 0) as progress
      FROM blocks b
      LEFT JOIN tasks t ON b.id = t.block_id
      GROUP BY b.id
    `).all();

    const progressByZone = db.prepare(`
      SELECT b.zone as name, 
             COALESCE(CAST(SUM(CASE WHEN t.status = 'Terminé' THEN 1 ELSE 0 END) AS FLOAT) / NULLIF(COUNT(t.id), 0) * 100, 0) as progress
      FROM blocks b
      LEFT JOIN tasks t ON b.id = t.block_id
      GROUP BY b.zone
    `).all();

    const weeklyProgress = db.prepare(`
      SELECT b.name, COUNT(t.id) as completed
      FROM blocks b
      LEFT JOIN tasks t ON b.id = t.block_id AND t.status = 'Terminé' AND t.end_date >= date('now', '-7 days')
      GROUP BY b.id
    `).all();

    const workforceDistribution = db.prepare(`
      SELECT b.name, SUM(t.workers) as workers
      FROM blocks b
      LEFT JOIN teams t ON b.id = t.block_id
      GROUP BY b.id
    `).all();

    const progressByElementType = db.prepare(`
      SELECT element_type as type, 
             COALESCE(CAST(SUM(CASE WHEN status = 'Terminé' THEN 1 ELSE 0 END) AS FLOAT) / NULLIF(COUNT(*), 0) * 100, 0) as progress
      FROM tasks
      WHERE element_type IS NOT NULL
      GROUP BY element_type
    `).all();

    const delayedTasksList = db.prepare(`
      SELECT t.element, b.name as block, 
             CAST(julianday('now') - julianday(t.end_date) AS INTEGER) as delay
      FROM tasks t
      JOIN blocks b ON t.block_id = b.id
      WHERE t.status != 'Terminé' AND t.end_date < date('now')
      LIMIT 5
    `).all();

    // Mock productivity data based on teams and their related tasks
    // In a real app, this would be more complex
    const teams = db.prepare("SELECT t.*, b.name as block_name FROM teams t JOIN blocks b ON t.block_id = b.id").all() as any[];
    const teamProductivity = teams.map(team => {
      // Simplified: just generate some plausible numbers if we don't have a direct mapping
      const assigned = Math.floor(Math.random() * 10) + 5;
      const completed = Math.floor(Math.random() * assigned);
      return {
        block: team.block_name,
        team: team.name,
        workers: team.workers,
        completed,
        assigned,
        productivity: (completed / assigned) * 100
      };
    });

    res.json({
      globalProgress: totalTasks.count > 0 ? (finishedTasks.count / totalTasks.count) * 100 : 0,
      activeWorkers: activeWorkers.count || 0,
      delayedTasks: delayedTasks.count || 0,
      totalBlocks: totalBlocks.count,
      totalFloors: totalFloors.count,
      totalElements: totalElements.count,
      taskStatusCounts,
      progressByBlock,
      progressByZone,
      weeklyProgress,
      teamProductivity,
      progressByElementType,
      delayedTasksList,
      workforceDistribution
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => res.sendFile(path.resolve("dist/index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
