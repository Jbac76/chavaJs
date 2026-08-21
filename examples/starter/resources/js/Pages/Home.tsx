import { Link, usePage } from '@inertiajs/react';
import { ArrowRight, Database, Package, Route as RouteIcon, Settings, Shield, Sparkles, Terminal, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import type { ComponentType } from 'react';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';

const FEATURE_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  package: Package,
  settings: Settings,
  route: RouteIcon,
  shield: Shield,
  database: Database,
  zap: Zap,
  sparkles: Sparkles,
};

interface HomePageProps {
  welcome: {
    framework: string;
    tagline: string;
    description: string;
    features: Array<{ name: string; description: string; icon: string }>;
  };
  app: { name: string; env: string; version: string };
  [key: string]: unknown;
}

const staggerContainer = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.3 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' as const } },
};

export default function Home() {
  const { props } = usePage<HomePageProps>();
  const { welcome, app } = props;

  return (
    <div className="space-y-16 sm:space-y-20">
      {/* ------------------------------------------------ hero */}
      <section className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <motion.div
          initial="hidden"
          animate="show"
          variants={staggerContainer}
          className="space-y-6"
        >
          <motion.div variants={staggerItem}>
            <Badge variant="secondary" className="gap-1.5">
              <Sparkles className="h-3 w-3 text-primary" />
              v{app.version} · Laravel&apos;s architecture, without PHP
            </Badge>
          </motion.div>

          <motion.h1
            variants={staggerItem}
            className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl"
          >
            The Laravel framework
            <br />
            for <span className="text-primary">Node.js</span>
          </motion.h1>

          <motion.p variants={staggerItem} className="max-w-xl text-lg leading-relaxed text-muted-foreground">
            {welcome.description}
          </motion.p>

          <motion.div variants={staggerItem} className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href="/about">
                See how it works
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/users">Browse seeded users</Link>
            </Button>
          </motion.div>
        </motion.div>

        {/* terminal card — the signature element */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
        >
          <Card className="overflow-hidden shadow-lg">
            <div className="flex items-center gap-2 border-b bg-secondary/50 px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-destructive/80" />
              <span className="h-3 w-3 rounded-full bg-amber-400/90" />
              <span className="h-3 w-3 rounded-full bg-emerald-400/90" />
              <span className="ml-2 font-mono text-xs text-muted-foreground">routes/web.ts</span>
            </div>
            <CardContent className="bg-card p-5 font-mono text-sm leading-7">
              <p>
                <span className="text-primary">import</span> {'{ Route }'}
                <span className="text-primary"> from</span> {'"../src/facades"'}
              </p>
              <p>
                <span className="text-primary">import</span> {'{ HomeController }'}
                <span className="text-primary"> from</span> {'"../app/Http/Controllers/HomeController"'}
              </p>
              <div className="my-2 border-t border-dashed" />
              <p>
                <span className="text-primary">Route</span>.get(<span className="text-emerald-500">&apos;/&apos;</span>, [
                <span className="text-amber-500">HomeController</span>, <span className="text-sky-500">&apos;index&apos;</span>])
              </p>
              <p className="pl-6">.name(<span className="text-emerald-500">&apos;home&apos;</span>);</p>
              <div className="my-2 border-t border-dashed" />
              <p>
                <span className="text-muted-foreground"># return Inertia.render(&apos;Home&apos;, …)</span>
              </p>
              <p>
                <span className="text-emerald-500">&gt;</span> GET / → React page → <span className="text-primary">200</span>
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </section>

      {/* ------------------------------------- server → client proof */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.45 }}
        className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground"
      >
        <Terminal className="h-4 w-4 text-primary" />
        <span>Connected to the chavaJs server —</span>
        <Badge variant="outline" className="font-mono">
          app.name: {app.name}
        </Badge>
        <Badge variant="outline" className="font-mono">
          env: {app.env}
        </Badge>
        <Badge variant="outline" className="font-mono">
          framework v{app.version}
        </Badge>
      </motion.section>

      {/* ------------------------------------------------ stack */}
      <section id="stack" className="space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.4 }}
          className="space-y-2"
        >
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Everything you know, in JavaScript
          </h2>
          <p className="max-w-2xl text-muted-foreground">
            Phases 1–3 of the build are live: the container, config, router, middleware pipeline,
            Inertia adapter — and now the Eloquent-equivalent ORM, with real migrations and seeded
            data flowing into this very page.
          </p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {welcome.features.map((feature) => {
            const Icon = FEATURE_ICONS[feature.icon] ?? Sparkles;
            return (
              <motion.div key={feature.name} variants={staggerItem}>
                <Card className="h-full transition-shadow duration-300 hover:shadow-md">
                  <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <CardTitle className="pt-1.5">{feature.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="leading-relaxed">{feature.description}</CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      </section>
    </div>
  );
}
