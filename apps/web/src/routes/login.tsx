import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { signIn } from "@/api/auth";
import { PasswordInput } from "@/components/password-input";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { safeRedirect } from "@/features/auth/redirect";
import { sessionQueryOptions, setSession } from "@/features/auth/session";
import { loginMessages, shellMessages, signInErrorMessages } from "@/messages";

const searchSchema = z.object({ redirect: z.string().optional().catch(undefined) });

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => searchSchema.parse(search),
  component: LoginPage,
});

// Client checks on submit, then again on each change (Login handoff). No length rule on the
// password; the email is trimmed, the password never.
const formSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, loginMessages.emailRequired)
    .pipe(z.email(loginMessages.emailInvalid)),
  password: z.string().min(1, loginMessages.passwordRequired),
});
type FormValues = z.input<typeof formSchema>;

function LoginPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const session = useQuery(sessionQueryOptions);

  useEffect(() => {
    document.title = shellMessages.documentTitle(loginMessages.pageTitle);
  }, []);

  // Nothing renders until the session check answers; a signed-in user goes straight on.
  const signedIn = Boolean(session.data?.user);
  useEffect(() => {
    if (signedIn)
      void navigate({ href: safeRedirect(redirect, window.location.origin), replace: true });
  }, [signedIn, redirect, navigate]);
  if (session.isPending || signedIn) return null;
  return <LoginForm />;
}

function LoginForm() {
  const queryClient = useQueryClient();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  // Guards a second submit (Enter in a field) before the busy state has rendered.
  const inFlight = useRef(false);
  const alertRef = useRef<HTMLDivElement>(null);

  const form = useForm<FormValues, unknown, z.output<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "" },
    reValidateMode: "onChange",
  });
  const { setFocus } = form;

  // Focus starts on Correo electrónico.
  useEffect(() => setFocus("email"), [setFocus]);
  // After a server or network error, focus goes to the alert.
  useEffect(() => {
    if (formError !== undefined) alertRef.current?.focus();
  }, [formError]);

  async function onSubmit(values: z.output<typeof formSchema>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    // The alert leaves while submitting and comes back with the answer, so it is focused again.
    setFormError(undefined);
    const result = await signIn(values.email, values.password);

    if (result.ok) {
      // Stays busy until the page goes on to `redirect` (its effect), the one way out of Login.
      await setSession(queryClient, { user: result.value, signedOut: false });
      return;
    }
    inFlight.current = false;
    setSubmitting(false);
    if (result.error === "INVALID_EMAIL") {
      form.setError("email", { message: loginMessages.emailInvalid }, { shouldFocus: true });
      return;
    }
    setFormError(signInErrorMessages[result.error]);
  }

  return (
    <main
      id="contenido"
      className="flex min-h-screen items-center justify-center bg-muted p-8 text-foreground"
    >
      <div className="flex w-100 flex-col gap-6 rounded-lg border border-border bg-card p-8 text-card-foreground">
        <div className="flex flex-col gap-1">
          <p className="text-section-title font-bold text-sidebar-primary">
            {shellMessages.wordmark}
          </p>
          <h1 className="text-page-title">{loginMessages.pageTitle}</h1>
        </div>
        <Form {...form}>
          <form
            noValidate
            // The password goes back to hidden on every submit, valid or not.
            onSubmit={(event) => {
              setPasswordVisible(false);
              void form.handleSubmit(onSubmit)(event);
            }}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{loginMessages.email}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      autoComplete="username"
                      spellCheck={false}
                      autoCapitalize="off"
                      aria-required="true"
                      placeholder={loginMessages.emailPlaceholder}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{loginMessages.password}</FormLabel>
                  <FormControl>
                    <PasswordInput
                      {...field}
                      autoComplete="current-password"
                      aria-required="true"
                      visible={passwordVisible}
                      onVisibleChange={setPasswordVisible}
                      labels={loginMessages.passwordInput}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {formError === undefined ? null : (
              <Alert
                ref={alertRef}
                variant="destructive"
                role="alert"
                tabIndex={-1}
                className="block"
              >
                {formError}
              </Alert>
            )}
            <Button type="submit" loading={submitting} className="w-full">
              {submitting ? loginMessages.submitting : loginMessages.submit}
            </Button>
          </form>
        </Form>
      </div>
    </main>
  );
}
