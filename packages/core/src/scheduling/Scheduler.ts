import type { Application } from '../foundation/Application';
import { spawn } from 'node:child_process';
import type { Job } from '../queue/Job';
import type { QueueManager } from '../queue/QueueManager';
import { cronMatches, describeCron } from './Cron';

/** A scheduled task (Laravel: Illuminate\Console\Scheduling\Event). */
export class ScheduledEvent {
  private expression = '* * * * *';
  private eventTimezone?: string;
  private betweenWindow: { start: string; end: string } | undefined;

  public constructor(
    private readonly runnable: () => Promise<unknown> | unknown,
    public readonly description: string,
    betweenWindow?: { start: string; end: string },
  ) {
    this.betweenWindow = betweenWindow;
  }

  // ------------------------------------------------------- frequency API

  public cron(expression: string): this {
    this.expression = expression;
    return this;
  }

  public everyMinute(): this {
    return this.cron('* * * * *');
  }

  public everyTwoMinutes(): this {
    return this.cron('*/2 * * * *');
  }

  public everyFiveMinutes(): this {
    return this.cron('*/5 * * * *');
  }

  public everyTenMinutes(): this {
    return this.cron('*/10 * * * *');
  }

  public everyFifteenMinutes(): this {
    return this.cron('*/15 * * * *');
  }

  public everyThirtyMinutes(): this {
    return this.cron('*/30 * * * *');
  }

  public hourly(): this {
    return this.cron('0 * * * *');
  }

  public hourlyAt(minute: number): this {
    return this.cron(`${minute} * * * *`);
  }

  public daily(): this {
    return this.cron('0 0 * * *');
  }

  public dailyAt(time: string): this {
    const [hour, minute = '0'] = time.split(':');
    return this.cron(`${minute} ${hour} * * *`);
  }

  public twiceDaily(first = 1, second = 13): this {
    return this.cron(`0 ${first},${second} * * *`);
  }

  public weekly(): this {
    return this.cron('0 0 * * 0');
  }

  public weeklyOn(day: number, time = '0:0'): this {
    const [hour, minute = '0'] = time.split(':');
    return this.cron(`${minute} ${hour} * * ${day}`);
  }

  public monthly(): this {
    return this.cron('0 0 1 * *');
  }

  public monthlyOn(day: number, time = '0:0'): this {
    const [hour, minute = '0'] = time.split(':');
    return this.cron(`${minute} ${hour} ${day} * *`);
  }

  public yearly(): this {
    return this.cron('0 0 1 1 *');
  }

  public timezone(tz: string): this {
    this.eventTimezone = tz;
    return this;
  }

  /** Only run inside an HH:MM window (Laravel: ->between('5:00', '10:00')). */
  public between(start: string, end: string): this {
    this.betweenWindow = { start, end };
    return this;
  }

  // ------------------------------------------------------------ execution

  /** Whether this task is due at the given time (Laravel: isDue()). */
  public isDue(date = new Date()): boolean {
    if (this.betweenWindow && !inTimeWindow(date, this.betweenWindow.start, this.betweenWindow.end)) {
      return false;
    }
    return cronMatches(this.expression, this.eventTimezone ? shiftToTimezone(date, this.eventTimezone) : date);
  }

  /** Run the task (Laravel: run()). */
  public async run(): Promise<void> {
    await this.runnable();
  }

  public getExpression(): string {
    return this.expression;
  }

  public getDescription(): string {
    return `${this.description} (${describeCron(this.expression)})`;
  }
}

/** In a [start, end] HH:MM window (Laravel: ->between('5:00', '10:00'))? */
function inTimeWindow(date: Date, start: string, end: string): boolean {
  const minutes = date.getHours() * 60 + date.getMinutes();
  const [startH, startM = '0'] = start.split(':');
  const [endH, endM = '0'] = end.split(':');
  const startMinutes = Number(startH) * 60 + Number(startM);
  const endMinutes = Number(endH) * 60 + Number(endM);
  if (startMinutes <= endMinutes) return minutes >= startMinutes && minutes <= endMinutes;
  return minutes >= startMinutes || minutes <= endMinutes; // overnight window
}

/** Reinterpret the Date's wall-clock in another timezone (approximation). */
function shiftToTimezone(date: Date, tz: string): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);
  const get = (type: string): number => {
    const part = parts.find((p) => p.type === type);
    return part ? Number(part.value) : 0;
  };
  return new Date(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    0,
    0,
  );
}

/**
 * Laravel's scheduler — registers tasks and reports which are due:
 *
 *   Schedule.call(() => { ... }).everyMinute();
 *   Schedule.job(new SendReportsJob()).dailyAt('02:00');
 *   Schedule.command('chava route:list').hourly();
 */
export class Scheduler {
  public readonly events: ScheduledEvent[] = [];

  public constructor(private readonly app: Application) {}

  public call(callback: () => Promise<unknown> | unknown, description = 'callable'): ScheduledEvent {
    const event = new ScheduledEvent(callback, description);
    this.events.push(event);
    return event;
  }

  public job(job: Job, description?: string): ScheduledEvent {
    const event = new ScheduledEvent(async () => {
      const manager = this.app.make<QueueManager>('queue');
      await manager.push(job);
    }, description ?? `job [${job.constructor.name}]`);
    this.events.push(event);
    return event;
  }

  /** Schedule a CLI command (Laravel: Schedule::command()). */
  public command(command: string, description?: string): ScheduledEvent {
    const event = new ScheduledEvent(
      () =>
        new Promise<void>((resolve, reject) => {
          const cwd = this.app.basePathDir();
          // `command` is Laravel-style ('chava route:list') — drop the
          // leading `chava` token; we always invoke bin/chava.js directly.
          const tokens = command.split(' ').filter((token) => token.length > 0);
          const args = tokens[0] === 'chava' ? tokens.slice(1) : tokens;
          // Windows shells need a single quoted command line — passing args
          // with shell:true drops the quotes around the node path.
          const child =
            process.platform === 'win32'
              ? spawn(`"${process.execPath}" bin/chava.js ${args.join(' ')}`, {
                  cwd,
                  stdio: 'inherit',
                  shell: true,
                })
              : spawn(process.execPath, ['bin/chava.js', ...args], {
                  cwd,
                  stdio: 'inherit',
                });
          child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Command failed: ${command}`))));
          child.on('error', reject);
        }),
      description ?? `command [${command}]`,
    );
    this.events.push(event);
    return event;
  }

  /** Tasks due right now (Laravel: schedule:run). */
  public dueEvents(date = new Date()): ScheduledEvent[] {
    return this.events.filter((event) => event.isDue(date));
  }

  /** Run every task that is currently due. Returns the number run. */
  public async runDue(date = new Date()): Promise<number> {
    const due = this.dueEvents(date);
    for (const event of due) {
      console.log(`  > Running scheduled task: ${event.getDescription()}`);
      await event.run();
    }
    return due.length;
  }
}
