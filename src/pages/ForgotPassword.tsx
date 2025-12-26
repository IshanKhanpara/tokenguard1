import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Shield, Mail, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { z } from 'zod';

const emailSchema = z.string().email('Please enter a valid email address');

export default function ForgotPassword() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      setEmailError(result.error.errors[0].message);
      return;
    }
    setEmailError('');
    
    setIsLoading(true);
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    
    setIsLoading(false);
    
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } else {
      setEmailSent(true);
    }
  };

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
              {emailSent ? 'Check Your Email' : 'Forgot Password'}
            </CardTitle>
            <CardDescription className="text-center">
              {emailSent 
                ? 'We sent you a password reset link' 
                : 'Enter your email and we\'ll send you a reset link'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {emailSent ? (
              <div className="text-center space-y-6">
                <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 text-success" />
                </div>
                <p className="text-muted-foreground">
                  We've sent a password reset link to <strong className="text-foreground">{email}</strong>. 
                  Click the link in the email to reset your password.
                </p>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/auth">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Sign In
                  </Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      className="pl-10"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  {emailError && <p className="text-sm text-destructive">{emailError}</p>}
                </div>
                
                <Button type="submit" className="w-full gradient-primary" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Send Reset Link
                </Button>
                
                <Button asChild variant="ghost" className="w-full">
                  <Link to="/auth">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Sign In
                  </Link>
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}