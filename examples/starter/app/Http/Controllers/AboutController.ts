import { Inertia } from '../../../src/facades';
import { Controller } from '../../../src/http/Controller';

export class AboutController extends Controller {
  public index() {
    return Inertia.render('About', {
      title: 'About',
      about: {
        heading: "Built with love, powered by AI",
        tagline: "Two worlds, one framework.",
        story: [
          {
            title: "Who built chavaJs",
            body: "chavaJs is developed by Joe Chavala — a PHP/Laravel developer who fell in love with JavaScript and decided to merge both worlds into a single full-stack framework.",
          },
          {
            title: "Created with AI — vibe coding",
            body: "Every line of chavaJs was written using AI. This is pure vibe coding — building something you love while loving the process of building it.",
          },
          {
            title: "The aim",
            body: "Coding while loving it. chavaJs brings the elegance and conventions of Laravel to the JavaScript ecosystem, so you get the best of both PHP and Node.js without compromise.",
          },
          {
            title: "Open source, forever",
            body: "chavaJs is and always will be open source. Free to use, free to fork, free to build with. The framework is yours.",
          },
        ],
      },
    });
  }
}
