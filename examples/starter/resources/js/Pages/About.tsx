import { usePage } from '@inertiajs/react';
import { Heart, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';

interface AboutPageProps {
  about: {
    heading: string;
    tagline: string;
    story: Array<{ title: string; body: string }>;
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
    <div className="w-full space-y-10">
      <motion.div
        initial="hidden"
        animate="show"
        variants={staggerContainer}
        className="space-y-4"
      >
        <motion.div variants={staggerItem} className="flex items-center gap-2 text-sm font-medium text-primary">
          <Heart className="h-4 w-4" />
          Our story
        </motion.div>
        <motion.h1 variants={staggerItem} className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {about.heading}
        </motion.h1>
        <motion.p variants={staggerItem} className="text-lg leading-relaxed text-muted-foreground">
          {about.tagline}
        </motion.p>
      </motion.div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="space-y-4"
      >
        {about.story.map((item, index) => (
          <motion.div key={item.title} variants={staggerItem}>
            <Card className="transition-shadow duration-300 hover:shadow-md">
              <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono text-sm font-bold text-primary">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <CardTitle className="pt-1.5">{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="leading-relaxed">{item.body}</CardDescription>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex items-center justify-center gap-2 rounded-lg border bg-muted/50 px-6 py-4 text-sm text-muted-foreground"
      >
        <Sparkles className="h-4 w-4 text-primary" />
        Made with AI — Joe Chavala
      </motion.div>
    </div>
  );
}
