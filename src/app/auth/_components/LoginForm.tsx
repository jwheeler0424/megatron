'use client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { authClient } from '@/lib/auth/client';
import { cn } from '@/lib/utils';
import { valibotResolver } from '@hookform/resolvers/valibot';
import { Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import * as v from 'valibot';

const loginFormSchema = v.object({
  username: v.pipe(v.string(), v.nonEmpty('Username is required')),
  password: v.pipe(v.string(), v.nonEmpty('Password is required')),
});

export function LoginForm({
  className,
  searchParams,
  ...props
}: React.ComponentProps<'div'> & {
  searchParams: {
    callback?: string | null;
  };
}) {
  const [viewPassword, setViewPassword] = React.useState(false);

  const router = useRouter();
  const loginParams = searchParams;
  const preservedCallback = loginParams ? loginParams.callback : null;
  const decodedCallback = decodeURIComponent(preservedCallback || '');
  const callbackPath = preservedCallback ? decodedCallback.split('?')[0] : '/';
  const callbackParams = preservedCallback ? decodedCallback.split('?')[1] : null;
  const callbackURL = new URL(
    callbackPath,
    process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000/'
  );
  if (callbackParams) {
    callbackURL.search = callbackParams;
  }

  const form = useForm<v.InferOutput<typeof loginFormSchema>>({
    resolver: valibotResolver(loginFormSchema),
    defaultValues: {
      username: '',
      password: '',
    },
    mode: 'onTouched',
  });
  const { formState } = form;
  const { isDirty, isValid, isReady } = formState;

  async function onSubmit(data: v.InferOutput<typeof loginFormSchema>) {
    form.clearErrors();
    console.log({ data });
    try {
      const { data: signInData, error } = await authClient.signIn.username({
        username: data.username, // required
        password: data.password, // required
        rememberMe: true,
      });
      if (!error) {
        router.replace(callbackURL.toString());
        return toast.success(`Signed in successfully.`);
      }
      form.setError('root', error);
      return toast.error(`Error signing in: ${error.message}`);
    } catch (err: unknown) {
      console.error('Error submitting account form:', err);
      toast.error('An error occurred while saving the account.');
      return;
    }
  }
  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader>
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-2xl font-bold">Welcome back</h1>
            <p className="text-muted-foreground text-balance">Login to your account</p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <FieldGroup>
              <Controller
                name="username"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field
                    data-invalid={fieldState.invalid}
                    className="flex items-center justify-center max-w-sm"
                  >
                    <FieldLabel htmlFor="form-login-username">Username</FieldLabel>
                    <Input
                      {...field}
                      id="form-login-username"
                      aria-invalid={fieldState.invalid}
                      autoComplete="off"
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                name="password"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field
                    data-invalid={fieldState.invalid}
                    className="flex items-center justify-center max-w-sm"
                  >
                    <FieldLabel htmlFor="form-login-password">Password</FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        {...field}
                        type={viewPassword ? 'text' : 'password'}
                        id="form-login-password"
                        aria-invalid={fieldState.invalid}
                        autoComplete="off"
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupButton
                          aria-label="Toggle password visibility"
                          title="Toggle password visibility"
                          size="icon-xs"
                          onClick={() => {
                            setViewPassword(!viewPassword);
                          }}
                        >
                          {viewPassword ? <EyeOff /> : <Eye />}
                        </InputGroupButton>
                      </InputGroupAddon>
                    </InputGroup>

                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <FieldError errors={form.formState.errors.root ? [form.formState.errors.root] : []} />
              <Field>
                <Button type="submit">Login</Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
