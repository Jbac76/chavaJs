import pc from 'picocolors';

// ------------------------------------------------------------------ logo

const LOGO = `
${pc.cyan('   ╔═══════════════════════════════════════════════════════╗')}
${pc.cyan('   ║')}  ${pc.bold(pc.white('  ██████╗ █████╗ ██████╗  █████╗ ███████╗██╗  ██╗'))}  ${pc.cyan('║')}
${pc.cyan('   ║')}  ${pc.bold(pc.white(' ██╔════╝██╔══██╗██╔══██╗██╔══██╗██╔════╝██║  ██║'))}  ${pc.cyan('║')}
${pc.cyan('   ║')}  ${pc.bold(pc.white(' ██║     ███████║██████╔╝███████║███████╗███████║'))}  ${pc.cyan('║')}
${pc.cyan('   ║')}  ${pc.bold(pc.white(' ██║     ██╔══██║██╔══██╗██╔══██║╚════██║██╔══██║'))}  ${pc.cyan('║')}
${pc.cyan('   ║')}  ${pc.bold(pc.white(' ╚██████╗██║  ██║██████╔╝██║  ██║███████║██║  ██║'))}  ${pc.cyan('║')}
${pc.cyan('   ║')}  ${pc.bold(pc.white('  ╚═════╝╚═╝  ╚═╝╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝'))}  ${pc.cyan('║')}
${pc.cyan('   ╚═══════════════════════════════════════════════════════╝')}
`;

export function printLogo(): void {
  console.log(LOGO);
  console.log(`  ${pc.dim('Laravel\'s experience, rebuilt for Node.js')}`);
  console.log();
}

// ------------------------------------------------------------------ congrats

export function printCongrats(name: string, includeDocs: boolean): void {
  console.log();
  console.log(pc.green('  ═══════════════════════════════════════════════════════'));
  console.log();
  console.log(pc.bold(pc.green('    ✨ Congrats, your app is ready! Build something amazing!')));
  console.log();
  console.log(pc.green('  ═══════════════════════════════════════════════════════'));
  console.log();
  console.log(`  ${pc.bold('Get started with:')}`);
  console.log();
  console.log(`    ${pc.cyan('cd')} ${pc.white(name)}`);
  console.log(`    ${pc.cyan('js')} migrate`);
  console.log(`    ${pc.cyan('js')} db:seed`);
  console.log(`    ${pc.cyan('npm run')} dev                  ${pc.dim('→ http://localhost:8080')}${includeDocs ? `  ${pc.dim('(docs at /docs)')}` : ''}`);
  console.log();
  console.log(`  ${pc.dim('`js` is your Artisan-equivalent command.')}`);
  console.log(`  ${pc.dim('Works with a global @chavajs/cli install, or `npx js <command>`')}`);
  console.log();
}

// ------------------------------------------------------------------ radio buttons

export function radioGroup(
  question: string,
  options: string[],
  fallback: string,
): string {
  console.log();
  console.log(`  ${pc.bold(pc.white(question))}`);
  console.log();
  for (let i = 0; i < options.length; i++) {
    const isDefault = options[i] === fallback;
    const label = isDefault ? `${options[i]}  ${pc.dim('(default)')}` : options[i];
    console.log(`    ${pc.cyan('○')}  ${label}`);
  }
  return fallback;
}

// ------------------------------------------------------------------ checkbox

export function checkbox(
  question: string,
  defaultOn: boolean,
): string {
  const symbol = defaultOn ? pc.green('◉') : pc.dim('○');
  const label = defaultOn ? pc.green('Yes') : pc.dim('No');
  console.log(`  ${pc.bold(pc.white(question))}`);
  console.log(`    ${symbol}  ${label}`);
  return defaultOn ? 'yes' : 'no';
}

// ------------------------------------------------------------------ progress

const STEP_ICONS = {
  pending: pc.dim('○'),
  active: pc.cyan('●'),
  done: pc.green('✓'),
  fail: pc.red('✗'),
};

export class Progress {
  private steps: string[];
  private current = -1;

  constructor(steps: string[]) {
    this.steps = steps;
  }

  /** Start the first step. */
  start(): void {
    this.current = 0;
    this.render();
  }

  /** Mark current step done and advance to the next. */
  step(): void {
    this.clear();
    if (this.current >= 0 && this.current < this.steps.length) {
      console.log(`  ${STEP_ICONS.done}  ${pc.dim(this.steps[this.current])}`);
    }
    this.current++;
    if (this.current < this.steps.length) {
      this.render();
    }
  }

  /** Mark current step as failed. */
  fail(msg?: string): void {
    this.clear();
    if (this.current >= 0 && this.current < this.steps.length) {
      console.log(`  ${STEP_ICONS.fail}  ${pc.red(this.steps[this.current])}${msg ? ` — ${msg}` : ''}`);
    }
  }

  /** Clear the active line. */
  clear(): void {
    if (process.stdout.isTTY) {
      process.stdout.write('\r\x1b[K');
    }
  }

  private render(): void {
    if (this.current >= 0 && this.current < this.steps.length) {
      process.stdout.write(`  ${STEP_ICONS.active}  ${pc.cyan(this.steps[this.current])}…`);
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
  console.log(pc.cyan(`  ┌${'─'.repeat(w)}┐`));
  console.log(pc.cyan(`  │`) + pc.bold(pc.white(pad(`  Project:  ${name}`))) + pc.cyan('│'));
  console.log(pc.cyan(`  │`) + pc.dim(pad(`  ${'─'.repeat(w - 2)}`)) + pc.cyan('│'));
  console.log(pc.cyan(`  │`) + pad(`  Database:       ${pc.white(database)}`) + pc.cyan('│'));
  console.log(pc.cyan(`  │`) + pad(`  Auth:           ${auth ? pc.green('Yes') : pc.red('No')}`) + pc.cyan('│'));
  console.log(pc.cyan(`  │`) + pad(`  Docs:           ${docs ? pc.green('Yes') : pc.red('No')}`) + pc.cyan('│'));
  console.log(pc.cyan(`  │`) + pad(`  Package Mgr:    ${pc.white(packageManager)}`) + pc.cyan('│'));
  console.log(pc.cyan(`  └${'─'.repeat(w)}┘`));
  console.log();
}

// ------------------------------------------------------------------ section divider

export function divider(label: string): void {
  console.log();
  console.log(pc.dim(`  ── ${label} ${'─'.repeat(Math.max(0, 40 - label.length))}`));
  console.log();
}

// ------------------------------------------------------------------ info line

export function info(msg: string): void {
  console.log(`  ${pc.cyan('ℹ')}  ${msg}`);
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
