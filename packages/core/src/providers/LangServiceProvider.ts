import { ServiceProvider } from '../container/ServiceProvider';
import { configureTranslator } from '../localization/Translator';

export class LangServiceProvider extends ServiceProvider {
  public async boot(): Promise<void> {
    const config = this.app.make('config') as { get(key: string, fallback?: unknown): unknown };
    const langConfig = config.get('lang', { locale: 'en', fallback_locale: 'en', paths: ['lang'] }) as {
      locale: string;
      fallback_locale: string;
      paths: string[];
    };

    configureTranslator(langConfig);
  }

  public register(): Promise<void> {
    return Promise.resolve();
  }
}
