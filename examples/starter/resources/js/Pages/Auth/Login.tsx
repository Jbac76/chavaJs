import { Link, useForm } from '@inertiajs/react';
import { LogIn } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/Components/ui/card';
import { FieldError } from '@/Components/field-error';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';

const MotionButton = motion(Button);

export default function Login() {
  const { data, setData, post, processing, errors } = useForm({
    email: '',
    password: '',
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    post('/login');
  }

  const invalid = (key: keyof typeof data) => (errors[key] ? { 'aria-invalid': true } : {});

  return (
    <div className="mx-auto w-full max-w-md">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Card>
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="font-display text-2xl">
              Welcome back to <span className="text-primary">chavaJs</span>
            </CardTitle>
            <CardDescription>Session-based auth, just like Laravel Breeze.</CardDescription>
          </CardHeader>
          <form onSubmit={submit} noValidate>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={data.email}
                  onChange={(e) => setData('email', e.target.value)}
                  className={errors.email ? 'border-destructive focus-visible:ring-destructive' : ''}
                  {...invalid('email')}
                />
                <FieldError id="email-error" message={errors.email} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={data.password}
                  onChange={(e) => setData('password', e.target.value)}
                  className={errors.password ? 'border-destructive focus-visible:ring-destructive' : ''}
                  {...invalid('password')}
                />
                <FieldError id="password-error" message={errors.password} />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <MotionButton
                type="submit"
                className="w-full"
                disabled={processing}
                whileTap={{ scale: 0.98 }}
                whileHover={{ scale: 1.01 }}
              >
                <LogIn className="h-4 w-4" />
                {processing ? 'Signing in…' : 'Sign in'}
              </MotionButton>
              <p className="text-center text-sm text-muted-foreground">
                No account?{' '}
                <Link href="/register" className="font-medium text-primary hover:underline">
                  Register
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
