'use client';

import { useMemo, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { signInWithMagicLink } from '@/app/actions/auth';
import { useI18n } from '@/lib/i18n/client';
import { trans } from '@/lib/i18n/rich';

export function MagicLinkForm({ mode = 'login' }: { mode?: 'login' | 'signup' }) {
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();
  const [sentTo, setSentTo] = useState<string | null>(null);

  // Schema muss in der Component gebaut werden, damit `emailInvalid` auf die
  // aktuelle Locale resolved. useMemo verhindert Neuerstellung bei jedem
  // Render (wichtig, weil zodResolver die Schema-Referenz behält).
  const formSchema = useMemo(
    () =>
      z.object({
        email: z.string().trim().toLowerCase().email(t('auth.emailInvalid')),
      }),
    [t],
  );
  type FormValues = z.infer<typeof formSchema>;

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
      toast.success(result.message ?? t('auth.linkSentToastDefault'));
    });
  }

  if (sentTo) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-brand-success" />
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">{t('auth.linkSentTitle')}</h3>
          <p className="text-sm text-muted-foreground">
            {trans(t('auth.linkSentHint'), {
              email: <span className="font-medium text-foreground">{sentTo}</span>,
            })}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {trans(t('auth.linkSentSpam'), {
            resend: (
              <button
                type="button"
                onClick={() => setSentTo(null)}
                className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
              >
                {t('auth.linkSentResend')}
              </button>
            ),
          })}
        </p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3" data-testid="auth-magic-link-form">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('auth.emailLabel')}</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder={t('auth.emailPlaceholder')}
                  data-testid="auth-email-input"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" size="lg" className="w-full" disabled={isPending} data-testid="auth-submit-button">
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Mail className="h-4 w-4" />
          )}
          {mode === 'signup' ? t('auth.submitSignup') : t('auth.sendMagicLink')}
        </Button>
      </form>
    </Form>
  );
}
