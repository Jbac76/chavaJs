import { Inertia } from '../../../src/facades';
import { Controller } from '../../../src/http/Controller';

export class AboutController extends Controller {
  public index() {
    return Inertia.render('About', {
      title: 'About',
      about: {
        heading: 'Laravel’s architecture, without PHP',
        pillars: [
          {
            title: 'Port the concepts, not the syntax',
            body: 'Every Laravel concept maps to its most natural JavaScript equivalent — facades become Proxies, service providers stay service providers, Eloquent becomes an Active Record ORM.',
          },
          {
            title: 'Convention over configuration',
            body: 'A predictable directory structure and sensible defaults mean you go from `chava new` to a working CRUD app in minutes.',
          },
          {
            title: 'Inertia is the only bridge',
            body: 'Controllers return Inertia responses and the React front-end just works — no separate REST API layer required.',
          },
        ],
      },
    });
  }
}
