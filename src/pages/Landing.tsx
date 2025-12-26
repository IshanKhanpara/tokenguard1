import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, Zap, BarChart3, Bell, Lock, Users, 
  ArrowRight, CheckCircle, Star, TrendingDown,
  AlertTriangle, Cpu, LineChart
} from 'lucide-react';

const features = [
  {
    icon: BarChart3,
    title: 'Real-Time Usage Tracking',
    description: 'Monitor your AI API token consumption in real-time with detailed breakdowns by model and endpoint.',
  },
  {
    icon: AlertTriangle,
    title: 'Cost Spike Detection',
    description: 'Automatically detect abnormal spending patterns and get alerts before costs spiral out of control.',
  },
  {
    icon: TrendingDown,
    title: 'Budget Enforcement',
    description: 'Set monthly usage limits and enforce hard stops to prevent accidental overspending.',
  },
  {
    icon: Bell,
    title: 'Smart Alerts',
    description: 'Receive email notifications at 80% usage and before hitting plan limits.',
  },
  {
    icon: Lock,
    title: 'Secure Key Storage',
    description: 'Your API keys are encrypted at rest using AES-256 encryption.',
  },
  {
    icon: Cpu,
    title: 'Multi-Provider Support',
    description: 'Works with OpenAI, Anthropic, Google AI, and more AI providers.',
  },
];

const testimonials = [
  {
    name: 'Sarah Chen',
    role: 'CTO at AIFlow',
    content: 'TokenGuard saved us $2,000 in the first month by catching a runaway script that was burning through tokens.',
    avatar: 'SC',
  },
  {
    name: 'Marcus Johnson',
    role: 'Freelance Developer',
    content: 'Finally, I can give clients accurate invoices. The usage tracking is incredibly detailed.',
    avatar: 'MJ',
  },
  {
    name: 'Priya Patel',
    role: 'Startup Founder',
    content: 'The budget limits feature is a lifesaver. No more surprise bills from OpenAI.',
    avatar: 'PP',
  },
];

const stats = [
  { value: '50M+', label: 'Tokens Tracked' },
  { value: '$120K+', label: 'Saved for Users' },
  { value: '2,500+', label: 'Active Users' },
  { value: '99.9%', label: 'Uptime' },
];

export default function Landing() {
  const { user } = useAuth();

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative overflow-hidden gradient-hero">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsl(243_75%_59%_/_0.1),_transparent_50%)]" />
        <div className="container mx-auto px-4 py-20 md:py-32 relative">
          <div className="max-w-4xl mx-auto text-center">
            <Badge className="mb-6 gradient-primary text-primary-foreground">
              AI API Cost Optimizer
            </Badge>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 leading-tight">
              Stop Overpaying for{' '}
              <span className="text-gradient">AI API Calls</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Monitor token usage, detect cost spikes, and enforce budgets. 
              Never get surprised by an AI API bill again.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="gradient-primary shadow-glow text-lg h-14 px-8">
                <Link to={user ? '/dashboard' : '/auth'}>
                  {user ? 'Go to Dashboard' : 'Start Free Trial'}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-lg h-14 px-8">
                <Link to="/pricing">View Pricing</Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-6">
              No credit card required • Free tier available
            </p>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="border-y border-border bg-card/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-3xl md:text-4xl font-bold text-gradient">{stat.value}</p>
                  <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 md:py-32 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Features</Badge>
            <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
              Everything You Need to Control AI Costs
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Powerful tools designed for developers, startups, and agencies who want to optimize their AI spending.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <Card key={feature.title} className="border-0 shadow-lg hover:shadow-xl transition-shadow bg-card">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 md:py-32 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">How It Works</Badge>
            <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
              Get Started in 3 Simple Steps
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { step: '1', title: 'Connect Your API Key', desc: 'Securely add your OpenAI or other AI provider API keys.' },
              { step: '2', title: 'Set Usage Limits', desc: 'Configure monthly budgets and alert thresholds.' },
              { step: '3', title: 'Monitor & Save', desc: 'Track usage in real-time and get alerts before overspending.' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-primary-foreground">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 md:py-32 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Testimonials</Badge>
            <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
              Trusted by Developers Worldwide
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {testimonials.map((testimonial) => (
              <Card key={testimonial.name} className="border-0 shadow-lg bg-card">
                <CardContent className="p-6">
                  <div className="flex items-center gap-1 mb-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} className="w-4 h-4 fill-warning text-warning" />
                    ))}
                  </div>
                  <p className="text-foreground mb-6 italic">"{testimonial.content}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-sm font-bold text-primary-foreground">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{testimonial.name}</p>
                      <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-32 gradient-hero">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-6">
              Ready to Take Control of Your AI Costs?
            </h2>
            <p className="text-xl text-muted-foreground mb-10">
              Join thousands of developers who are saving money and preventing overspending with TokenGuard.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="gradient-primary shadow-glow text-lg h-14 px-8">
                <Link to={user ? '/dashboard' : '/auth'}>
                  {user ? 'Go to Dashboard' : 'Get Started Free'}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </Button>
            </div>
            <div className="flex flex-wrap justify-center gap-6 mt-10 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-success" />
                Free tier included
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-success" />
                No credit card required
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-success" />
                Cancel anytime
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}