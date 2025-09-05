import { v4 as uuidv4 } from 'uuid';
import { Task } from '../types';
import { Database } from '../db/database';


function nowISO(): string {
  return new Date().toISOString();
}

export class TaskService {
  constructor(private db: Database) {}

  async createTask(taskData: Partial<Task>): Promise<Task> {
    // TODO: Implement task creation
    // 1. Generate UUID for the task
    // 2. Set default values (completed: false, is_deleted: false)
    // 3. Set sync_status to 'pending'
    // 4. Insert into database
    // 5. Add to sync queue

    
      const id = taskData.id || uuidv4();
    const created_at = nowISO();
    const updated_at = created_at;

    const task: Task = {
      id,
      title: taskData.title ?? 'Untitled',
      description: taskData.description ?? '',
      completed: taskData.completed ?? false,
      created_at: new Date(created_at),
      updated_at: new Date(updated_at),
      is_deleted: false,
      sync_status: 'pending',
      server_id: taskData.server_id,
      last_synced_at: undefined,
    };

    await this.db.run(
      `INSERT INTO tasks (id, title, description, completed, created_at, updated_at, is_deleted, sync_status, server_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.id,
        task.title,
        task.description,
        task.completed ? 1 : 0,
        created_at,
        updated_at,
        0,
        'pending',
        task.server_id ?? null,
      ]
    );

    // Add to sync queue
    const queueId = uuidv4();
    await this.db.run(
      `INSERT INTO sync_queue (id, task_id, operation, data)
       VALUES (?, ?, ?, ?)`,
      [queueId, task.id, 'create', JSON.stringify(task)]
    );

    return task;
  }


  async updateTask(id: string, updates: Partial<Task>): Promise<Task | null> {
    // TODO: Implement task update
    // 1. Check if task exists
    // 2. Update task in database
    // 3. Update updated_at timestamp
    // 4. Set sync_status to 'pending'
    // 5. Add to sync queue
  const existing = await this.getTask(id);
    if (!existing) return null;

    const updatedAt = nowISO();
    const updated: Task = {
      ...existing,
      ...updates,
      updated_at: new Date(updatedAt),
      sync_status: 'pending',
    };

    await this.db.run(
      `UPDATE tasks
         SET title = ?, description = ?, completed = ?, updated_at = ?, is_deleted = ?, sync_status = ?
       WHERE id = ?`,
      [
        updated.title,
        updated.description,
        updated.completed ? 1 : 0,
        updatedAt,
        updated.is_deleted ? 1 : 0,
        'pending',
        id,
      ]
    );

    const queueId = uuidv4();
    await this.db.run(
      `INSERT INTO sync_queue (id, task_id, operation, data)
       VALUES (?, ?, ?, ?)`,
      [queueId, id, 'update', JSON.stringify(updates)]
    );

    return updated;
  }

  async deleteTask(id: string): Promise<boolean> {
    // TODO: Implement soft delete
    // 1. Check if task exists
    // 2. Set is_deleted to true
    // 3. Update updated_at timestamp
    // 4. Set sync_status to 'pending'
    // 5. Add to sync queue
  const existing = await this.getTask(id);
    if (!existing) return false;

    const updatedAt = nowISO();
    await this.db.run(
      `UPDATE tasks
         SET is_deleted = 1, updated_at = ?, sync_status = ?
       WHERE id = ?`,
      [updatedAt, 'pending', id]
    );

    const queueId = uuidv4();
    await this.db.run(
      `INSERT INTO sync_queue (id, task_id, operation, data)
       VALUES (?, ?, ?, ?)`,
      [queueId, id, 'delete', '{}']
    );

    return true;
  }

  async getTask(id: string): Promise<Task | null> {
    // TODO: Implement get single task
    // 1. Query database for task by id
    // 2. Return null if not found or is_deleted is true
const row = await this.db.get(
      `SELECT * FROM tasks WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!row) return null;
    if (row.is_deleted) return null;

    return this.rowToTask(row);
  }

  async getAllTasks(): Promise<Task[]> {
    const rows = await this.db.all(
      `SELECT * FROM tasks WHERE is_deleted = 0`
    );
    return rows.map((r) => this.rowToTask(r));
  }

  // async getAllTasks(): Promise<Task[]> {
  //   const rows = await this.db.all(
  //     `SELECT * FROM tasks WHERE is_deleted = 0`
  //   );
  //   return rows.map((r) => this.rowToTask(r));
  // }

  // async getAllTasks(): Promise<Task[]> {
  //   // TODO: Implement get all non-deleted tasks
  //   // 1. Query database for all tasks where is_deleted = false
  //   // 2. Return array of tasks
  //   throw new Error('Not implemented');
  // }

  async getTasksNeedingSync(): Promise<Task[]> {
    // TODO: Get all tasks with sync_status = 'pending' or 'error'
    const rows = await this.db.all(
      `SELECT * FROM tasks WHERE sync_status IN ('pending','error')`
    );
    return rows.map((r) => this.rowToTask(r));
  }
   private rowToTask(row: any): Task {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      completed: !!row.completed,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      is_deleted: !!row.is_deleted,
      sync_status: row.sync_status,
      server_id: row.server_id || undefined,
      last_synced_at: row.last_synced_at
        ? new Date(row.last_synced_at)
        : undefined,
    };
  }
}
