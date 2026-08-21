import type { Job } from './Job';

/** The contract every queue driver implements (Laravel: Queue contract). */
export interface QueueDriver {
  /** Run a job now (or as soon as possible). */
  push(job: Job): Promise<void>;
  /** Run a job after a delay in seconds. */
  later(delaySeconds: number, job: Job): Promise<void>;
}

/** A job pulled from the database driver for processing. */
export interface DatabaseJobRecord {
  id: number;
  queue: string;
  payload: string;
  attempts: number;
  available_at: number;
  reserved_at: number | null;
  created_at: number;
}

/** Result of popping a job off the queue. */
export interface PoppedJob {
  id: number | string;
  payload: string;
  attempts: number;
}
