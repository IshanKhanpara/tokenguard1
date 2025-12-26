import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, Users } from 'lucide-react';

export default function AcceptInvite() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [status, setStatus] = useState<'loading' | 'ready' | 'success' | 'error'>('loading');
  const [teamName, setTeamName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('Invalid invitation link');
      return;
    }

    // Check if invitation is valid
    const checkInvite = async () => {
      const { data: invite, error } = await supabase
        .from('team_invites')
        .select('*, teams(name)')
        .eq('token', token)
        .eq('status', 'pending')
        .single();

      if (error || !invite) {
        setStatus('error');
        setErrorMessage('This invitation is invalid or has already been used');
        return;
      }

      if (new Date(invite.expires_at) < new Date()) {
        setStatus('error');
        setErrorMessage('This invitation has expired');
        return;
      }

      setTeamName((invite.teams as any)?.name || 'Unknown Team');
      setStatus('ready');
    };

    checkInvite();
  }, [token]);

  const handleAccept = async () => {
    if (!user) {
      // Redirect to auth with return URL
      navigate(`/auth?redirect=/accept-invite?token=${token}`);
      return;
    }

    setIsAccepting(true);
    try {
      const { data, error } = await supabase.functions.invoke('team-invite', {
        body: { action: 'accept', token },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setStatus('success');
      toast({
        title: 'Welcome to the team!',
        description: `You've joined ${data.teamName || teamName}`,
      });
    } catch (error: any) {
      setStatus('error');
      setErrorMessage(error.message);
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDecline = async () => {
    try {
      await supabase.functions.invoke('team-invite', {
        body: { action: 'decline', token },
      });
      toast({ title: 'Invitation Declined' });
      navigate('/');
    } catch (error) {
      console.error('Error declining invite:', error);
      navigate('/');
    }
  };

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <Card className="max-w-md mx-auto border-0 shadow-lg">
          {status === 'loading' && (
            <CardContent className="pt-8 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Checking invitation...</p>
            </CardContent>
          )}

          {status === 'ready' && (
            <>
              <CardHeader className="text-center">
                <div className="w-16 h-16 rounded-full gradient-primary mx-auto mb-4 flex items-center justify-center">
                  <Users className="w-8 h-8 text-primary-foreground" />
                </div>
                <CardTitle className="text-2xl">Team Invitation</CardTitle>
                <CardDescription>
                  You've been invited to join <strong>{teamName}</strong>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!user && (
                  <p className="text-sm text-muted-foreground text-center bg-secondary/50 p-3 rounded-lg">
                    You'll need to sign in or create an account to accept this invitation.
                  </p>
                )}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleDecline}
                    disabled={isAccepting}
                  >
                    Decline
                  </Button>
                  <Button
                    className="flex-1 gradient-primary"
                    onClick={handleAccept}
                    disabled={isAccepting}
                  >
                    {isAccepting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {user ? 'Accept Invitation' : 'Sign In to Accept'}
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {status === 'success' && (
            <CardContent className="pt-8 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">You're In!</h2>
              <p className="text-muted-foreground mb-6">
                You've successfully joined {teamName}.
              </p>
              <Button onClick={() => navigate('/dashboard')} className="gradient-primary">
                Go to Dashboard
              </Button>
            </CardContent>
          )}

          {status === 'error' && (
            <CardContent className="pt-8 text-center">
              <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">Invalid Invitation</h2>
              <p className="text-muted-foreground mb-6">{errorMessage}</p>
              <Button variant="outline" onClick={() => navigate('/')}>
                Go Home
              </Button>
            </CardContent>
          )}
        </Card>
      </div>
    </Layout>
  );
}
