import { Router, Request, Response } from 'express';
import { SyncService } from '../services/syncService';
import { TaskService } from '../services/taskService';
import { Database } from '../db/database';

export function createSyncRouter(db: Database): Router {
  const router = Router();
  const taskService = new TaskService(db);
  const syncService = new SyncService(db, taskService);

  // Trigger manual sync
  router.post('/sync', async (req: Request, res: Response) => {
    // TODO: Implement sync endpoint
    // 1. Check connectivity first
    // 2. Call syncService.sync()
    // 3. Return sync result
    try {
      const online = await syncService.checkConnectivity();
      if (!online) {
        return res.status(503).json({ error: 'Server not reachable' });
      }
      const result = await syncService.sync();
      res.json(result);
    } catch {
      res.status(500).json({ error: 'Failed to perform sync' });
    }
  });

  // Check sync status
  router.get('/status', async (req: Request, res: Response) => {
    // TODO: Implement sync status endpoint
    // 1. Get pending sync count
    // 2. Get last sync timestamp
    // 3. Check connectivity
    // 4. Return status summary
    try {
      const pending = await db.get(
        `SELECT COUNT(*) as count FROM sync_queue`
      );
      const lastSynced = await db.get(
        `SELECT MAX(last_synced_at) as last FROM tasks`
      );
      const online = await syncService.checkConnectivity();

      res.json({
        pending: pending?.count ?? 0,
        last_synced_at: lastSynced?.last ?? null,
        online,
      });
    } catch {
      res.status(500).json({ error: 'Failed to fetch sync status' });
    }
  });

  // Batch sync endpoint (for server-side)
  router.post('/batch', async (req: Request, res: Response) => {
    // TODO: Implement batch sync endpoint
    // This would be implemented on the server side
    // to handle batch sync requests from clients
  res.status(501).json({ error: 'Batch sync not implemented on client API' });
  });

  // Health check endpoint
  router.get('/health', async (req: Request, res: Response) => {
     res.json({ status: 'ok', timestamp: new Date() });
  });


  return router;
}