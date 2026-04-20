'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { signInWithMagicLink } from '@/app/actions/auth';

const formSchema = z.object({
  email: z.string().trim().toLowerCase().email('Bitte gib eine gültige Email ein.'),
});
type FormValues = z.infer<typeof formSchema>;

export function MagicLinkForm({ mode = 'login' }: { mode?: 'login' | 'signup' }) {
  const [isPending, startTransition] = useTransition();
  const [sentTo, setSentTo] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '' },
  });

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set('email', values.email);
      const result = await signInWithMagicLink(fd);
      if (!result.ok) {
        if (result.field === 'email') {
          form.setError('email', { message: result.error });
        } else {
          toast.error(result.error);
        }
        return;
      }
      setSentTo(values.email);
      toast.success(result.message ?? 'Email ist unterwegs.');
    });
  }

  if (sentTo) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-brand-success" />
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Link unterwegs</h3>
          <p className="text-sm text-muted-foreground">
            Wir haben dir einen Anmelde-Link an <span className="font-medium text-foreground">{sentTo}</span> geschickt.
            Klick drauf und du bist drin.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Nichts bekommen? Check Spam, oder{' '}
          <button
            type="button"
            onClick={() => setSentTo(null)}
            className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
          >
            nochmal senden
          </button>
          .
        </p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="du@example.com"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" size="lg" className="w-full" disabled={isPending}>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Mail className="h-4 w-4" />
          )}
          {mode === 'signup' ? 'Account erstellen' : 'Anmelde-Link senden'}
        </Button>
      </form>
    </Form>
  );
}
