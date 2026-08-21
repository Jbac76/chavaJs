import { Link, useForm } from '@inertiajs/react';
import { UserPlus } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/Components/ui/card';
import { FieldError } from '@/Components/field-error';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';

const MotionButton = motion(Button);

export default function Register() {
  const { data, setData, post, processing, errors } = useForm({
    name: '',
    email: '',
    password: '',
    password_confirmation: '',
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    post('/register');
  }

  const field = (key: keyof typeof data) => ({
    className: errors[key] ? 'border-destructive focus-visible:ring-destructive' : '',
    ...(errors[key] ? { 'aria-invalid': true } : {}),
  });

  return (
    <div className="mx-auto w-full max-w-md">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Card>
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="font-display text-2xl">
              Create your <span className="text-primary">chavaJs</span> account
            </CardTitle>
            <CardDescription>Validation powered by the Laravel-style Validator.</CardDescription>
          </CardHeader>
          <form onSubmit={submit} noValidate>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" autoComplete="name" value={data.name} onChange={(e) => setData('name', e.target.value)} {...field('name')} />
                <FieldError id="name-error" message={errors.name} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={data.email}
                  onChange={(e) => setData('email', e.target.value)}
                  {...field('email')}
                />
                <FieldError id="email-error" message={errors.email} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={data.password}
                  onChange={(e) => setData('password', e.target.value)}
                  {...field('password')}
                />
                <FieldError id="password-error" message={errors.password} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password_confirmation">Confirm password</Label>
                <Input
                  id="password_confirmation"
                  type="password"
                  autoComplete="new-password"
                  value={data.password_confirmation}
                  onChange={(e) => setData('password_confirmation', e.target.value)}
                  {...field('password_confirmation')}
                />
                <FieldError id="password_confirmation-error" message={errors.password_confirmation} />
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
                <UserPlus className="h-4 w-4" />
                {processing ? 'Creating account…' : 'Register'}
              </MotionButton>
              <p className="text-center text-sm text-muted-foreground">
                Already registered?{' '}
                <Link href="/login" className="font-medium text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
