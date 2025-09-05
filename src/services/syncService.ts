import axios from 'axios';
import { Task, SyncQueueItem, SyncResult, BatchSyncRequest, BatchSyncResponse } from '../types';
import { Database } from '../db/database';
import { TaskService } from './taskService';
import { v4 as uuidv4 } from 'uuid';

export class SyncService {
  private apiUrl: string;
   private batchSize: number;
  private maxRetries: number;
  
  constructor(
    private db: Database,
    private taskService: TaskService,
    apiUrl: string = process.env.API_BASE_URL || 'http://localhost:3000/api'
  ) {
    this.apiUrl = apiUrl;
        this.batchSize = parseInt(process.env.SYNC_BATCH_SIZE || '10', 10);
    this.maxRetries = parseInt(process.env.SYNC_MAX_RETRIES || '3', 10);
  }

  async sync(): Promise<SyncResult> {
    // TODO: Main sync orchestration method
    // 1. Get all items from sync queue
    // 2. Group items by batch (use SYNC_BATCH_SIZE from env)
    // 3. Process each batch
    // 4. Handle success/failure for each item
    // 5. Update sync status in database
    // 6. Return sync result summary
  const queueItems = await this.db.all(`SELECT * FROM sync_queue ORDER BY created_at ASC`);

    let successCount = 0;
    let failCount = 0;
    const errors: SyncResult['errors'] = [];

    for (let i = 0; i < queueItems.length; i += this.batchSize) {
      const batch = queueItems.slice(i, i + this.batchSize);
      try {
        const response = await this.processBatch(batch);

        for (const item of response.processed_items) {
          if (item.status === 'success') {
            successCount++;
            await this.updateSyncStatus(item.client_id, 'synced', {
              server_id: item.server_id,
              ...item.resolved_data,
            });
          } else if (item.status === 'conflict' && item.resolved_data) {
            successCount++;
            await this.updateSyncStatus(item.client_id, 'synced', {
              server_id: item.server_id,
              ...item.resolved_data,
            });
          } else {
            failCount++;
            errors.push({
              task_id: item.client_id,
              operation: 'sync',
              error: item.error || 'Unknown sync error',
              timestamp: new Date(),
            });
            await this.updateSyncStatus(item.client_id, 'error');
          }
        }
      } catch (err: any) {
        for (const item of batch) {
          failCount++;
          errors.push({
            task_id: item.task_id,
            operation: item.operation,
            error: err.message,
            timestamp: new Date(),
          });
          await this.handleSyncError(item, err);
        }
      }
    }

    return {
      success: failCount === 0,
      synced_items: successCount,
      failed_items: failCount,
      errors,
    };
  }

  async addToSyncQueue(taskId: string, operation: 'create' | 'update' | 'delete', data: Partial<Task>): Promise<void> {
    // TODO: Add operation to sync queue
    // 1. Create sync queue item
    // 2. Store serialized task data
    // 3. Insert into sync_queue table
    const item: SyncQueueItem = {
      id: uuidv4(),
      task_id: taskId,
      operation,
      data,
      created_at: new Date(),
      retry_count: 0,
    };

    await this.db.run(
      `INSERT INTO sync_queue (id, task_id, operation, data, created_at, retry_count)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.task_id,
        item.operation,
        JSON.stringify(item.data),
        item.created_at.toISOString(),
        item.retry_count,
      ]
    );
  }

  private async processBatch(items: SyncQueueItem[]): Promise<BatchSyncResponse> {
    // TODO: Process a batch of sync items
    // 1. Prepare batch request
    // 2. Send to server
    // 3. Handle response
    // 4. Apply conflict resolution if needed
 const request: BatchSyncRequest = {
      items: items.map((i) => ({
        ...i,
        data: i.data,
      })),
      client_timestamp: new Date(),
    };

    const { data } = await axios.post<BatchSyncResponse>(
      `${this.apiUrl}/sync`,
      request
    );
 return data;
  }

  private async resolveConflict(localTask: Task, serverTask: Task): Promise<Task> {
    // TODO: Implement last-write-wins conflict resolution
    // 1. Compare updated_at timestamps
    // 2. Return the more recent version
    // 3. Log conflict resolution decision
   const localTime = new Date(localTask.updated_at).getTime();
    const serverTime = new Date(serverTask.updated_at).getTime();

    // last-write-wins
    return localTime >= serverTime ? localTask : serverTask;
  }

  private async updateSyncStatus(taskId: string, status: 'synced' | 'error', serverData?: Partial<Task>): Promise<void> {
    // TODO: Update task sync status
    // 1. Update sync_status field
    // 2. Update server_id if provided
    // 3. Update last_synced_at timestamp
    // 4. Remove from sync queue if successful
     const lastSyncedAt = new Date().toISOString();

    await this.db.run(
      `UPDATE tasks
         SET sync_status = ?, server_id = COALESCE(?, server_id), last_synced_at = ?
       WHERE id = ?`,
      [status, serverData?.server_id || null, lastSyncedAt, taskId]
    );

    if (status === 'synced') {
      await this.db.run(`DELETE FROM sync_queue WHERE task_id = ?`, [taskId]);
    }
  }

  private async handleSyncError(item: SyncQueueItem, error: Error): Promise<void> {
    // TODO: Handle sync errors
    // 1. Increment retry count
    // 2. Store error message
    // 3. If retry count exceeds limit, mark as permanent failure
    const newRetryCount = item.retry_count + 1;

    if (newRetryCount > this.maxRetries) {
      await this.db.run(
        `UPDATE tasks SET sync_status = 'error' WHERE id = ?`,
        [item.task_id]
      );
      await this.db.run(
        `UPDATE sync_queue
           SET retry_count = ?, error_message = ?
         WHERE id = ?`,
        [newRetryCount, error.message, item.id]
      );
    } else {
      await this.db.run(
        `UPDATE sync_queue
           SET retry_count = ?, error_message = ?
         WHERE id = ?`,
        [newRetryCount, error.message, item.id]
      );
    }
  };
  

  async checkConnectivity(): Promise<boolean> {
    // TODO: Check if server is reachable
    // 1. Make a simple health check request
    // 2. Return true if successful, false otherwise
    try {
      await axios.get(`${this.apiUrl}/health`, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}