process.env.MAIL_MAILER = 'array';

import { describe, expect, it } from 'vitest';
import { freshApp } from '../helpers/db';
import { Mail } from '../../src/facades';
import { Mailable } from '../../src/mail/Mailable';
import type { Envelope, MailableContent } from '../../src/mail/Mailable';
import { renderTemplate } from '../../src/mail/Template';
import { User } from '../../app/Models/User';
import { WelcomeMail } from '../../app/Mail/WelcomeMail';

class SimpleMail extends Mailable {
  public envelope(): Envelope {
    return { subject: 'Simple', to: { address: 'to@example.com', name: 'To' } };
  }

  public content(): MailableContent {
    return { html: '<p>Hello</p>', text: 'Hello' };
  }
}

describe('Mail (Phase 5)', () => {
  it('collects sent messages on the array driver with the default From', async () => {
    const app = await freshApp();
    const mail = app.make<import('../../src/mail/MailManager').MailManager>('mail');
    // Default From comes from config/mail.ts → MAIL_FROM_ADDRESS (hello@chava.dev).

    await mail.send(new SimpleMail());

    const sent = mail.sent();
    expect(sent).toHaveLength(1);
    const message = sent[0];
    expect(message.subject).toBe('Simple');
    expect(message.to[0].address).toBe('to@example.com');
    expect(message.from?.address).toBe('hello@chava.dev');
  });

  it('supports recipient chains Mail.to(...).cc(...).send(...)', async () => {
    const app = await freshApp();
    const mail = app.make<import('../../src/mail/MailManager').MailManager>('mail');

    await mail.to('a@example.com').cc('b@example.com').bcc('c@example.com').send(new SimpleMail());

    const sent = mail.sent();
    expect(sent).toHaveLength(1);
    expect(sent[0].to.map((r) => r.address)).toEqual(['a@example.com']);
    expect(sent[0].cc?.map((r) => r.address)).toEqual(['b@example.com']);
    expect(sent[0].bcc?.map((r) => r.address)).toEqual(['c@example.com']);
  });

  it('builds WelcomeMail from a model with the rendered view', async () => {
    const app = await freshApp();
    const user = (await User.create({ name: 'Ada Lovelace', email: 'ada@example.com', password: 'x' })) as User;

    const mail = new WelcomeMail(user);
    const message = await mail.buildMessage();
    expect(message.subject).toBe('Welcome to chavaJs!');
    expect(message.to[0].address).toBe('ada@example.com');
    expect(message.html).toContain('Welcome, Ada Lovelace!');
    expect(message.html).toContain('ada@example.com');
  });

  it('renders Blade-like templates with escaping, conditionals and loops', () => {
    const html = renderTemplate(
      '<h1>{{ name }}</h1>' +
        '@if (admin)<p>admin</p>@endif' +
        '@each (item in items)<li>{{ item }}</li>@endeach' +
        '{!! raw !!}',
      { name: '<b>X</b>', admin: true, items: ['a', 'b'], raw: '<i>raw</i>' },
    );

    expect(html).toContain('&lt;b&gt;X&lt;/b&gt;'); // escaped
    expect(html).toContain('<p>admin</p>'); // conditional
    expect(html).toContain('<li>a</li><li>b</li>'); // loop
    expect(html).toContain('<i>raw</i>'); // raw output
  });

  it('skips @if blocks whose condition is falsy', () => {
    const html = renderTemplate('@if (published)<p>yes</p>@endif<p>no</p>', { published: false });
    expect(html).not.toContain('yes');
    expect(html).toContain('no');
  });
});
