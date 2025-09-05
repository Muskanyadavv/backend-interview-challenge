import { Router, Request, Response } from 'express';
import { TaskService } from '../services/taskService';
import { SyncService } from '../services/syncService';
import { Database } from '../db/database';

export function createTaskRouter(db: Database): Router {
  const router = Router();
  const taskService = new TaskService(db);
  const syncService = new SyncService(db, taskService);

  // Get all tasks
  router.get('/', async (req: Request, res: Response) => {
    try {
      const tasks = await taskService.getAllTasks();
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  });

  // Get single task
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const task = await taskService.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      res.json(task);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch task' });
    }
  });

  // Create task
  router.post('/', async (req: Request, res: Response) => {
    // TODO: Implement task creation endpoint
    // 1. Validate request body
    // 2. Call taskService.createTask()
    // 3. Return created task
    try {
      const { title, description } = req.body;
      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }
      const task = await taskService.createTask({ title, description });
      await syncService.addToSyncQueue(task.id, 'create', task);
      res.status(201).json(task);
    } catch {
      res.status(500).json({ error: 'Failed to create task' });
    }
  });

  // Update task
  router.put('/:id', async (req: Request, res: Response) => {
    // TODO: Implement task update endpoint
    // 1. Validate request body
    // 2. Call taskService.updateTask()
    // 3. Handle not found case
    // 4. Return updated task
     try {
      const updates = req.body;
      const updatedTask = await taskService.updateTask(req.params.id, updates);
      if (!updatedTask) return res.status(404).json({ error: 'Task not found' });
      await syncService.addToSyncQueue(updatedTask.id, 'update', updates);
      res.json(updatedTask);
    } catch {
      res.status(500).json({ error: 'Failed to update task' });
    }
  });

  // Delete task
  router.delete('/:id', async (req: Request, res: Response) => {
    // TODO: Implement task deletion endpoint
    // 1. Call taskService.deleteTask()
    // 2. Handle not found case
    // 3. Return success response
      try {
      const deleted = await taskService.deleteTask(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Task not found' });
      await syncService.addToSyncQueue(req.params.id, 'delete', {});
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to delete task' });
    }
  });
   

  return router;
}