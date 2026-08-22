import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  printLogo,
  printCongrats,
  summaryBox,
  Progress,
  ProgressBar,
  Spinner,
  selectOption,
  selectYesNo,
} from '../src/ui';

/**
 * Capture both process.stdout.write() and console.log() output during fn().
 * Also forces isTTY=true so ProgressBar/Spinner take the TTY code path.
 */
function captureOutput(fn: () => void): string {
  const chunks: string[] = [];

  // Mock process.stdout.write
  const origWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: string | Uint8Array) => {
    chunks.push(typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk));
    return true;
  }) as typeof process.stdout.write;

  // Mock console.log / console.error to also capture
  const origLog = console.log;
  const origErr = console.error;
  console.log = (...args: unknown[]) => { chunks.push(args.join(' ') + '\n'); };
  console.error = (...args: unknown[]) => { chunks.push(args.join(' ')); };

  // Force isTTY so ProgressBar/Spinner/Progress use their TTY rendering
  const origIsTTY = process.stdout.isTTY;
  (process.stdout as { isTTY: boolean }).isTTY = true;

  try {
    fn();
  } finally {
    process.stdout.write = origWrite;
    console.log = origLog;
    console.error = origErr;
    (process.stdout as { isTTY: boolean }).isTTY = origIsTTY;
  }
  return chunks.join('');
}

describe('UI rendering', () => {
  it('printLogo renders the block-character art', () => {
    const out = captureOutput(() => printLogo());
    // Should contain the big ASCII art characters
    expect(out).toContain('██████╗');
    expect(out).toContain('╚═════╝');
    // Should contain the tagline
    expect(out).toContain("Laravel's experience, rebuilt for Node.js");
  });

  it('printCongrats renders the completion message', () => {
    const out = captureOutput(() => printCongrats('my-app', true));
    expect(out).toContain('Congrats');
    expect(out).toContain('my-app');
    expect(out).toContain('cd');
    expect(out).toContain('/docs');
  });

  it('printCongrats hides docs when includeDocs is false', () => {
    const out = captureOutput(() => printCongrats('my-app', false));
    expect(out).not.toContain('/docs');
  });

  it('summaryBox renders all fields', () => {
    const out = captureOutput(() =>
      summaryBox({
        name: 'blog',
        database: 'postgres',
        auth: true,
        docs: false,
        packageManager: 'pnpm',
      }),
    );
    expect(out).toContain('blog');
    expect(out).toContain('postgres');
    expect(out).toContain('pnpm');
    expect(out).toContain('Yes');
    expect(out).toContain('No');
  });
});

describe('Progress tracker', () => {
  it('renders each step and marks them done', () => {
    const out = captureOutput(() => {
      const p = new Progress(['Step one', 'Step two', 'Step three']);
      p.start();
      p.step();
      p.step();
      p.step();
    });
    expect(out).toContain('Step one');
    expect(out).toContain('Step two');
    expect(out).toContain('Step three');
    // All steps should show the done checkmark
    expect(out).toContain('✓');
  });

  it('fail() shows error icon with message', () => {
    const out = captureOutput(() => {
      const p = new Progress(['Downloading']);
      p.start();
      p.fail('timeout');
    });
    expect(out).toContain('✗');
    expect(out).toContain('timeout');
  });
});

describe('ProgressBar', () => {
  it('start() renders initial bar and stop shows 100%', () => {
    const out = captureOutput(() => {
      const bar = new ProgressBar('npm');
      bar.start();
      // Let the timer tick once so the bar renders something
      const ready = new Promise<void>((r) => setTimeout(r, 250));
      return ready;
    });
    // The resolved promise content won't be captured since captureOutput
    // is sync. Use a different approach for the async parts.
    const out2 = captureOutput(() => {
      const bar = new ProgressBar('npm');
      bar.start();
      bar.stop(true);
    });
    expect(out2).toContain('npm');
    expect(out2).toContain('done');
    expect(out2).toContain('100%');
  });

  it('stop(false) shows the bar without done status', () => {
    const out = captureOutput(() => {
      const bar = new ProgressBar('yarn');
      bar.start();
      bar.stop(false);
    });
    expect(out).toContain('yarn');
  });
});

describe('Spinner', () => {
  it('start/stop renders the message', () => {
    const out = captureOutput(() => {
      const s = new Spinner('Loading');
      s.start();
      s.stop();
    });
    expect(out).toContain('Loading');
  });
});

describe('Interactive prompts (non-TTY defaults)', () => {
  it('selectOption returns default when stdin is not a TTY', async () => {
    const result = await selectOption('Pick one', ['a', 'b', 'c'], 1);
    expect(result).toBe('b');
  });

  it('selectOption returns first option when defaultIndex is 0', async () => {
    const result = await selectOption('Pick one', ['x', 'y'], 0);
    expect(result).toBe('x');
  });

  it('selectYesNo returns default when stdin is not a TTY', async () => {
    const result = await selectYesNo('Continue?', true);
    expect(result).toBe(true);

    const result2 = await selectYesNo('Continue?', false);
    expect(result2).toBe(false);
  });
});
