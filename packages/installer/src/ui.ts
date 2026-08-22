import pc from 'picocolors';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

// ------------------------------------------------------------------ colors
// picocolors has no orange — use raw ANSI for the framework brand color.

const ORANGE = '\x1b[38;2;255;102;0m';
const ORANGE_DIM = '\x1b[38;2;200;80;0m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

// ------------------------------------------------------------------ logo

/** Print a big, bold ASCII-art logo in orange gradient. */
export function printLogo(): void {
  const r = RESET;
  const b = BOLD;

  // 6-line block-character art for "chavaJs" (ANSI Shadow font)
  const art = [
    ' ██████╗██╗  ██╗ █████╗ ██╗   ██╗ █████╗      ██╗███████╗',
    '██╔════╝██║  ██║██╔══██╗██║   ██║██╔══██╗     ██║██╔════╝',
    '██║     ███████║███████║██║   ██║███████║██   ██║███████╗',
    '██║     ██╔══██║██╔══██║██║   ██║██╔══██║██   ██║╚════██║',
    '╚██████╗██║  ██║██║  ██║╚██╗ ██╔╝██║  ██║╚█████╔╝███████║',
    ' ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═══╝  ╚═╝  ╚═╝ ╚════╝ ╚══════╝'];

  // Orange gradient — bright at top, deeper at bottom
  const gradient = [
    '\x1b[38;2;255;130;30m',   // bright orange
    '\x1b[38;2;255;115;15m',
    '\x1b[38;2;255;100;5m',
    '\x1b[38;2;240;85;0m',
    '\x1b[38;2;220;70;0m',
    '\x1b[38;2;200;60;0m',    // deep orange
  ];

  console.log();
  for (let i = 0; i < art.length; i++) {
    process.stdout.write(`  ${gradient[i]}${b}${art[i]}${r}\n`);
  }
  console.log();
  console.log(`  ${DIM}Laravel's experience, rebuilt for Node.js${r}`);
  console.log();
}

// ------------------------------------------------------------------ congrats

export function printCongrats(name: string, includeDocs: boolean): void {
  console.log();
  console.log(`${ORANGE}  ═══════════════════════════════════════════════════════${RESET}`);
  console.log();
  console.log(`${BOLD}${ORANGE}    ✨ Congrats, your app is ready! Build something amazing!${RESET}`);
  console.log();
  console.log(`${ORANGE}  ═══════════════════════════════════════════════════════${RESET}`);
  console.log();
  console.log(`  ${BOLD}Get started with:${RESET}`);
  console.log();
  console.log(`    ${ORANGE}cd${RESET} ${pc.white(name)}`);
  console.log(`    ${ORANGE}js${RESET} migrate`);
  console.log(`    ${ORANGE}js${RESET} db:seed`);
  console.log(`    ${ORANGE}npm run${RESET} dev                  ${DIM}→ http://localhost:8080${RESET}${includeDocs ? `  ${DIM}(docs at /docs)${RESET}` : ''}`);
  console.log();
  console.log(`  ${DIM}\`js\` is your Artisan-equivalent command.${RESET}`);
  console.log(`  ${DIM}Works with a global @chavajs/cli install, or \`npx js <command>\`${RESET}`);
  console.log();
}

// ------------------------------------------------------------------ interactive selector

export async function selectOption(
  question: string,
  options: string[],
  defaultIndex: number = 0,
): Promise<string> {
  if (!stdin.isTTY) return options[defaultIndex] ?? options[0];

  let selected = defaultIndex;
  const lineCount = options.length + 1; // question line + option lines

  const render = () => {
    stdout.write(`  ${BOLD}${pc.white(question)}${RESET}\n`);
    for (let i = 0; i < options.length; i++) {
      const marker = i === selected ? `${ORANGE}❯${RESET}` : ' ';
      const label = i === selected ? `${BOLD}${ORANGE}${options[i]}${RESET}` : `  ${options[i]}`;
      const defaultTag = i === defaultIndex ? ` ${DIM}(default)${RESET}` : '';
      stdout.write(`    ${marker} ${label}${defaultTag}\n`);
    }
  };

  const redraw = () => {
    // Move cursor to top of the block, clear everything below, then redraw
    stdout.write(`\x1b[${lineCount}A\r\x1b[J`);
    render();
  };

  // Hide cursor, show initial state
  stdout.write('\x1b[?25l');
  render();

  const rl = createInterface({ input: stdin, output: stdout });
  stdin.setRawMode(true);
  stdin.resume();

  const result = await new Promise<string>((resolve) => {
    const onData = (buf: Buffer) => {
      const key = buf.toString();

      if (key === '\r' || key === '\n') {
        cleanup();
        resolve(options[selected]);
        return;
      }
      if (key === '\x1b[A') {  // up arrow
        selected = (selected - 1 + options.length) % options.length;
        redraw();
        return;
      }
      if (key === '\x1b[B') {  // down arrow
        selected = (selected + 1) % options.length;
        redraw();
        return;
      }
      if (key === '\x03') {  // Ctrl+C
        cleanup();
        process.exit(130);
      }
    };

    const cleanup = () => {
      stdin.removeListener('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      rl.close();
      // Cursor is already at bottom of block after last render — just show it
      stdout.write('\x1b[?25h');
    };

    stdin.on('data', onData);
  });

  return result;
}

/** Toggle yes/no — press Enter to accept, arrow keys to toggle. */
export async function selectYesNo(
  question: string,
  defaultYes: boolean = true,
): Promise<boolean> {
  if (!stdin.isTTY) return defaultYes;

  let yes = defaultYes;

  const render = () => {
    const yesLabel = yes ? `${BOLD}${ORANGE}Yes${RESET}` : `  Yes`;
    const noLabel = !yes ? `${BOLD}${ORANGE}No${RESET}` : `  No`;
    stdout.write(`  ${BOLD}${pc.white(question)}${RESET}  [${yesLabel} / ${noLabel}]\n`);
  };

  const redraw = () => {
    stdout.write('\x1b[1A\r\x1b[J');
    render();
  };

  stdout.write('\x1b[?25l');
  render();

  const rl = createInterface({ input: stdin, output: stdout });
  stdin.setRawMode(true);
  stdin.resume();

  const result = await new Promise<boolean>((resolve) => {
    const onData = (buf: Buffer) => {
      const key = buf.toString();

      if (key === '\r' || key === '\n') {
        cleanup();
        resolve(yes);
        return;
      }
      if (key === '\x1b[D' || key === '\x1b[C') {
        yes = !yes; // toggle on left/right arrow
        redraw();
        return;
      }
      if (key === 'y' || key === 'Y') {
        yes = true;
        cleanup();
        resolve(true);
        return;
      }
      if (key === 'n' || key === 'N') {
        yes = false;
        cleanup();
        resolve(false);
        return;
      }
      if (key === '\x03') { cleanup(); process.exit(130); }
    };

    const cleanup = () => {
      stdin.removeListener('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      rl.close();
      stdout.write('\x1b[?25h');
    };

    stdin.on('data', onData);
  });

  return result;
}

// ------------------------------------------------------------------ summary box

export function summaryBox(opts: {
  name: string;
  database: string;
  auth: boolean;
  docs: boolean;
  packageManager: string;
}): void {
  const { name, database, auth, docs, packageManager } = opts;
  const w = 46;
  const pad = (s: string) => s + ' '.repeat(Math.max(0, w - s.length));

  console.log();
  console.log(`${ORANGE}  ┌${'─'.repeat(w)}┐${RESET}`);
  console.log(`${ORANGE}  │${RESET}${BOLD}${pc.white(pad(`  Project:  ${name}`))}${ORANGE}│${RESET}`);
  console.log(`${ORANGE}  │${RESET}${DIM}${pad(`  ${'─'.repeat(w - 2)}`)}${ORANGE}│${RESET}`);
  console.log(`${ORANGE}  │${RESET}  Database:       ${pc.white(database)}${' '.repeat(Math.max(0, w - 16 - database.length))}${ORANGE}│${RESET}`);
  console.log(`${ORANGE}  │${RESET}  Auth:           ${auth ? pc.green('Yes') : pc.red('No')}${' '.repeat(Math.max(0, w - 16 - (auth ? 3 : 2)))}${ORANGE}│${RESET}`);
  console.log(`${ORANGE}  │${RESET}  Docs:           ${docs ? pc.green('Yes') : pc.red('No')}${' '.repeat(Math.max(0, w - 16 - (docs ? 3 : 2)))}${ORANGE}│${RESET}`);
  console.log(`${ORANGE}  │${RESET}  Package Mgr:    ${pc.white(packageManager)}${' '.repeat(Math.max(0, w - 16 - packageManager.length))}${ORANGE}│${RESET}`);
  console.log(`${ORANGE}  └${'─'.repeat(w)}┘${RESET}`);
  console.log();
}

// ------------------------------------------------------------------ progress

const STEP_ICONS = {
  pending: `${DIM}○${RESET}`,
  active: `${ORANGE}●${RESET}`,
  done: `${pc.green('✓')}`,
  fail: `${pc.red('✗')}`,
};

export class Progress {
  private steps: string[];
  private current = -1;

  constructor(steps: string[]) {
    this.steps = steps;
  }

  start(): void {
    this.current = 0;
    this.render();
  }

  step(): void {
    this.clear();
    if (this.current >= 0 && this.current < this.steps.length) {
      console.log(`  ${STEP_ICONS.done}  ${DIM}${this.steps[this.current]}${RESET}`);
    }
    this.current++;
    if (this.current < this.steps.length) {
      this.render();
    }
  }

  fail(msg?: string): void {
    this.clear();
    if (this.current >= 0 && this.current < this.steps.length) {
      console.log(`  ${STEP_ICONS.fail}  ${pc.red(this.steps[this.current])}${msg ? ` — ${msg}` : ''}`);
    }
  }

  clear(): void {
    if (process.stdout.isTTY) {
      process.stdout.write('\r\x1b[K');
    }
  }

  private render(): void {
    if (this.current >= 0 && this.current < this.steps.length) {
      process.stdout.write(`  ${STEP_ICONS.active}  ${ORANGE}${this.steps[this.current]}${RESET}…`);
    }
  }
}

// ------------------------------------------------------------------ progress bar

export class ProgressBar {
  private label: string;
  private width = 30;
  private current = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(label: string) {
    this.label = label;
  }

  start(): void {
    this.current = 0;
    this.render(0);
    // Animate smoothly: slow down as we approach 95%
    this.timer = setInterval(() => {
      if (this.current < 70) {
        this.current += Math.random() * 4 + 1;
      } else if (this.current < 90) {
        this.current += Math.random() * 1.5 + 0.3;
      } else if (this.current < 95) {
        this.current += Math.random() * 0.3 + 0.05;
      }
      this.current = Math.min(this.current, 95);
      this.render(this.current);
    }, 200);
  }

  stop(success: boolean): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.render(success ? 100 : this.current, success);
  }

  private render(pct: number, done = false): void {
    const filled = Math.round((pct / 100) * this.width);
    const empty = this.width - filled;
    const bar = `${ORANGE}${'█'.repeat(filled)}${DIM}${'░'.repeat(empty)}${RESET}`;
    const pctStr = `${Math.round(pct)}%`.padStart(4);
    const icon = done ? `${pc.green('✓')}` : `${ORANGE}●${RESET}`;
    const status = done ? `${pc.green('done')}` : `${ORANGE}installing${RESET}`;

    if (process.stdout.isTTY) {
      process.stdout.write(`\r  ${icon}  ${bar} ${pctStr}  ${status}  ${DIM}${this.label}${RESET}`);
    } else if (done) {
      console.log(`  ${icon}  ${bar} ${pctStr}  ${status}`);
    }
  }
}

// ------------------------------------------------------------------ spinner (for indeterminate waits)

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export class Spinner {
  private message: string;
  private frame = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(message: string) {
    this.message = message;
  }

  start(): void {
    if (!process.stdout.isTTY) {
      console.log(`  ${this.message}…`);
      return;
    }
    process.stdout.write(`  ${SPINNER_FRAMES[0]}  ${this.message}…`);
    this.timer = setInterval(() => {
      this.frame = (this.frame + 1) % SPINNER_FRAMES.length;
      process.stdout.write(`\r  ${SPINNER_FRAMES[this.frame]}  ${this.message}…`);
    }, 80);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (process.stdout.isTTY) {
      process.stdout.write('\r\x1b[K');
    }
  }
}

// ------------------------------------------------------------------ helpers

export function divider(label: string): void {
  console.log();
  console.log(`${DIM}  ── ${label} ${'─'.repeat(Math.max(0, 40 - label.length))}${RESET}`);
  console.log();
}

export function info(msg: string): void {
  console.log(`  ${ORANGE}ℹ${RESET}  ${msg}`);
}

export function success(msg: string): void {
  console.log(`  ${pc.green('✓')}  ${msg}`);
}

export function warn(msg: string): void {
  console.log(`  ${pc.yellow('⚠')}  ${msg}`);
}

export function error(msg: string): void {
  console.error(`  ${pc.red('✗')}  ${msg}`);
}
