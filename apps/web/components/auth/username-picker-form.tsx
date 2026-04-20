'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { usernameSchema } from '@shared/schemas';
import { claimUsername, checkUsernameAvailable } from '@/app/actions/auth';

const formSchema = z.object({
  username: usernameSchema,
});
type FormValues = z.infer<typeof formSchema>;

type Availability = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export function UsernamePickerForm({ next = '/' }: { next?: string }) {
  const router = useRouter();
  const [isSubmitting, startSubmit] = useTransition();
  const [availability, setAvailability] = useState<Availability>('idle');
  const [reason, setReason] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { username: '' },
    mode: 'onChange',
  });

  const watchUsername = form.watch('username');

  // Debounced availability check — triggers 400ms after user stops typing.
  useEffect(() => {
    const trimmed = watchUsername.trim().toLowerCase();
    if (!trimmed) {
      setAvailability('idle');
      setReason(null);
      return;
    }
    const parsed = usernameSchema.safeParse(trimmed);
    if (!parsed.success) {
      setAvailability('invalid');
      setReason(parsed.error.issues[0]?.message ?? null);
      return;
    }
    setAvailability('checking');
    setReason(null);

    const handle = setTimeout(async () => {
      try {
        const result = await checkUsernameAvailable(parsed.data);
        setAvailability(result.available ? 'available' : 'taken');
        setReason(result.reason ?? null);
      } catch {
        // Network hiccup — let the submit re-check catch it.
        setAvailability('idle');
      }
    }, 400);

    return () => clearTimeout(handle);
  }, [watchUsername]);

  function onSubmit(values: FormValues) {
    startSubmit(async () => {
      const fd = new FormData();
      fd.set('username', values.username);
      const result = await claimUsername(fd);
      if (!result.ok) {
        if (result.field === 'username') {
          form.setError('username', { message: result.error });
        } else {
          toast.error(result.error);
        }
        return;
      }
      toast.success('Willkommen bei Serlo.');
      // safeNext guard already applied client-side — server re-validates on next navigation.
      router.push(next.startsWith('/') && !next.startsWith('//') ? next : '/');
      router.refresh();
    });
  }

  const canSubmit = availability === 'available' && !isSubmitting;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    @
                  </span>
                  <Input
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="pl-7 pr-10"
                    placeholder="deinname"
                    {...field}
                    onChange={(e) => field.onChange(e.target.value.toLowerCase())}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {availability === 'checking' ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : availability === 'available' ? (
                      <Check className="h-4 w-4 text-brand-success" />
                    ) : availability === 'taken' || availability === 'invalid' ? (
                      <X className="h-4 w-4 text-destructive" />
                    ) : null}
                  </div>
                </div>
              </FormControl>
              <FormDescription>
                3-24 Zeichen, nur a-z, 0-9, _. Dein Username ist öffentlich und nicht änderbar.
              </FormDescription>
              {availability === 'taken' || availability === 'invalid' ? (
                <p className="text-sm font-medium text-destructive">{reason ?? 'Nicht verfügbar.'}</p>
              ) : availability === 'available' ? (
                <p className="text-sm font-medium text-brand-success">Verfügbar.</p>
              ) : (
                <FormMessage />
              )}
            </FormItem>
          )}
        />
        <Button type="submit" size="lg" className="w-full" disabled={!canSubmit}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Weiter
        </Button>
      </form>
    </Form>
  );
}
