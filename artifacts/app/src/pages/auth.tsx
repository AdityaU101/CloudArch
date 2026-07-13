import { useState } from "react";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  useLogin,
  useRegister,
  getGetCurrentUserQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Server, Loader2, LogIn, UserPlus, Sparkles } from "lucide-react";

type Mode = "login" | "register";

/**
 * Full-screen sign-in / sign-up. Rendered by the AuthGate whenever there is no
 * active session, so it owns the whole viewport (the sidebar never shows).
 */
export default function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const login = useLogin();
  const register = useRegister();
  const pending = login.isPending || register.isPending;

  const onSuccess = (user: unknown) => {
    queryClient.setQueryData(getGetCurrentUserQueryKey(), user);
  };

  const onError = (err: unknown) => {
    const message =
      err && typeof err === "object" && "data" in err && (err as any).data?.error
        ? (err as any).data.error
        : "Something went wrong. Please try again.";
    setError(message);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === "login") {
      login.mutate({ data: { email, password } }, { onSuccess, onError });
    } else {
      register.mutate({ data: { email, password, name } }, { onSuccess, onError });
    }
  };

  return (
    <div className="dark flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm space-y-6"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
            <Server className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">CloudArch</h1>
            <p className="text-sm text-muted-foreground">Architecture Studio</p>
          </div>
        </div>

        <Card className="border-primary/15 bg-card/60 shadow-lg">
          <CardHeader className="pb-4">
            <div className="inline-flex w-full items-center rounded-lg border border-border bg-muted/50 p-0.5">
              {(["login", "register"] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setError(null);
                  }}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m === "login" ? <LogIn className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
                  {m === "login" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>
            <CardTitle className="pt-3 text-base">
              {mode === "login" ? "Welcome back" : "Set up your workspace"}
            </CardTitle>
            <CardDescription>
              {mode === "login"
                ? "Sign in to access your private architecture library."
                : "Your designs are private to your account."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "register" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ada Lovelace"
                    autoComplete="name"
                    required
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "register" ? "At least 8 characters" : "••••••••"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  minLength={mode === "register" ? 8 : undefined}
                  required
                />
              </div>

              {error && (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </p>
              )}

              <Button type="submit" disabled={pending} className="w-full gap-2">
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {mode === "login" ? "Sign in" : "Create account"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Private per-user workspaces · sessions stay on this device
        </p>
      </motion.div>
    </div>
  );
}
