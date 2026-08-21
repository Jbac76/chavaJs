import { usePage } from '@inertiajs/react';
import { Compass } from 'lucide-react';
import { motion } from 'motion/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';

interface AboutPageProps {
  about: {
    heading: string;
    pillars: Array<{ title: string; body: string }>;
  };
  [key: string]: unknown;
}

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' as const } },
};

export default function About() {
  const { props } = usePage<AboutPageProps>();
  const { about } = props;

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <motion.div
        initial="hidden"
        animate="show"
        variants={staggerContainer}
        className="space-y-4"
      >
        <motion.div variants={staggerItem} className="flex items-center gap-2 text-sm font-medium text-primary">
          <Compass className="h-4 w-4" />
          Design pillars
        </motion.div>
        <motion.h1 variants={staggerItem} className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {about.heading}
        </motion.h1>
        <motion.p variants={staggerItem} className="text-lg leading-relaxed text-muted-foreground">
          chavaJs ports Laravel&apos;s conventions — not its syntax. Every concept finds its most
          natural JavaScript equivalent.
        </motion.p>
      </motion.div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="space-y-4"
      >
        {about.pillars.map((pillar, index) => (
          <motion.div key={pillar.title} variants={staggerItem}>
            <Card className="transition-shadow duration-300 hover:shadow-md">
              <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono text-sm font-bold text-primary">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <CardTitle className="pt-1.5">{pillar.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="leading-relaxed">{pillar.body}</CardDescription>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
