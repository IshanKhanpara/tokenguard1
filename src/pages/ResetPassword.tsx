import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Shield, Lock, Loader2, CheckCircle } from 'lucide-react';
import { z } from 'zod';

const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [resetComplete, setResetComplete] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);

  useEffect(() => {
    // Check if we have a valid recovery session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsValidSession(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsValidSession(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const newErrors: { password?: string; confirm?: string } = {};
    
    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      newErrors.password = passwordResult.error.errors[0].message;
    }
    
    if (password !== confirmPassword) {
      newErrors.confirm = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    
    setIsLoading(true);
    
    const { error } = await supabase.auth.updateUser({
      password: password,
    });
    
    setIsLoading(false);
    
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } else {
      setResetComplete(true);
      toast({
        title: 'Password Updated',
        description: 'Your password has been successfully reset.',
      });
    }
  };

  const handleContinue = () => {
    navigate('/');
  };

  if (!isValidSession && !resetComplete) {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
        <div className="w-full max-w-md animate-fade-in">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary shadow-glow mb-4">
              <Shield className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">TokenGuard</h1>
          </div>
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">
                Invalid or expired reset link. Please request a new password reset.
              </p>
              <Button onClick={() => navigate('/forgot-password')} className="mt-4">
                Request New Link
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo & Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary shadow-glow mb-4">
            <Shield className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">TokenGuard</h1>
          <p className="text-muted-foreground mt-2">AI API Cost Optimizer & Usage Guard</p>
        </div>

        <Card className="border-0 shadow-lg">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl font-bold text-center">
              {resetComplete ? 'Password Reset Complete' : 'Reset Password'}
            </CardTitle>
            <CardDescription className="text-center">
              {resetComplete 
                ? 'Your password has been successfully updated' 
                : 'Enter your new password below'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {resetComplete ? (
              <div className="text-center space-y-6">
                <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 text-success" />
                </div>
                <p className="text-muted-foreground">
                  You can now sign in with your new password.
                </p>
                <Button onClick={handleContinue} className="w-full gradient-primary">
                  Continue to Dashboard
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      className="pl-10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      className="pl-10"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.confirm && <p className="text-sm text-destructive">{errors.confirm}</p>}
                </div>
                
                <Button type="submit" className="w-full gradient-primary" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Reset Password
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}