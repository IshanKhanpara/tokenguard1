import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schemas
const sendInviteSchema = z.object({
  action: z.literal("send"),
  email: z.string().email().max(255),
  role: z.enum(["admin", "member"]),
});

const acceptInviteSchema = z.object({
  action: z.literal("accept"),
  token: z.string().uuid(),
});

const declineInviteSchema = z.object({
  action: z.literal("decline"),
  token: z.string().uuid(),
});

const removeMemberSchema = z.object({
  action: z.literal("remove_member"),
  memberId: z.string().uuid(),
  teamId: z.string().uuid(),
});

const updateRoleSchema = z.object({
  action: z.literal("update_role"),
  memberId: z.string().uuid(),
  teamId: z.string().uuid(),
  role: z.enum(["admin", "member"]),
});

const updateSpendingLimitSchema = z.object({
  action: z.literal("update_spending_limit"),
  memberId: z.string().uuid(),
  teamId: z.string().uuid(),
  spendingLimit: z.number().min(0).max(1000000).nullable(),
  alertThreshold: z.number().min(0).max(100).optional(),
});

const teamInviteSchema = z.discriminatedUnion("action", [
  sendInviteSchema,
  acceptInviteSchema,
  declineInviteSchema,
  removeMemberSchema,
  updateRoleSchema,
  updateSpendingLimitSchema,
]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Parse and validate request body
    const rawBody = await req.json();
    const parseResult = teamInviteSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      console.error("Validation error:", parseResult.error.errors);
      return new Response(
        JSON.stringify({ error: "Invalid request parameters", details: parseResult.error.errors.map(e => e.message) }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const body = parseResult.data;
    console.log(`Team invite action: ${body.action} by user ${user.id}`);

    // Get user's team
    const { data: team } = await supabase
      .from("teams")
      .select("id, name, owner_id")
      .eq("owner_id", user.id)
      .single();

    switch (body.action) {
      case 'send': {
        const { email, role } = body;

        if (!team) {
          throw new Error("You don't have a team. Upgrade to Team plan first.");
        }

        // Check if already a member
        const { data: existingMember } = await supabase
          .from("team_members")
          .select("id, user_id")
          .eq("team_id", team.id)
          .single();

        // Check member count limit (5 for team plan)
        const { count: memberCount } = await supabase
          .from("team_members")
          .select("*", { count: 'exact', head: true })
          .eq("team_id", team.id);

        if ((memberCount || 0) >= 5) {
          throw new Error("Team member limit reached (5 members max)");
        }

        // Check for existing pending invite
        const { data: existingInvite } = await supabase
          .from("team_invites")
          .select("id")
          .eq("team_id", team.id)
          .eq("email", email.toLowerCase())
          .eq("status", "pending")
          .single();

        if (existingInvite) {
          throw new Error("An invitation is already pending for this email");
        }

        // Create invite
        const { data: invite, error: inviteError } = await supabase
          .from("team_invites")
          .insert({
            team_id: team.id,
            email: email.toLowerCase(),
            invited_by: user.id,
            role,
          })
          .select()
          .single();

        if (inviteError) throw inviteError;

        // Get inviter's profile
        const { data: inviterProfile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("user_id", user.id)
          .single();

        const inviterName = inviterProfile?.full_name || inviterProfile?.email || "A team admin";
        const acceptUrl = `${supabaseUrl.replace('.supabase.co', '')}/accept-invite?token=${invite.token}`;

        // Send invite email
        await resend.emails.send({
          from: "Team Invitations <onboarding@resend.dev>",
          to: [email],
          subject: `You're invited to join ${team.name}`,
          html: `
            <!DOCTYPE html>
            <html>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #8b5cf6, #6366f1); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
                <h1 style="color: white; margin: 0; font-size: 24px;">🎉 You're Invited!</h1>
              </div>
              <p>Hi there,</p>
              <p><strong>${inviterName}</strong> has invited you to join <strong>${team.name}</strong> as a ${role}.</p>
              <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
                <a href="${acceptUrl}" style="background: linear-gradient(135deg, #8b5cf6, #6366f1); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Accept Invitation</a>
              </div>
              <p style="color: #6b7280; font-size: 14px;">This invitation expires in 7 days.</p>
              <p style="color: #6b7280; font-size: 14px;">If you didn't expect this invitation, you can safely ignore this email.</p>
            </body>
            </html>
          `,
        });

        console.log(`Invite sent to ${email} for team ${team.id}`);
        return new Response(
          JSON.stringify({ success: true, invite }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case 'accept': {
        const { token } = body;

        // Find invite by token
        const { data: invite, error: findError } = await supabase
          .from("team_invites")
          .select("*, teams(name, owner_id)")
          .eq("token", token)
          .eq("status", "pending")
          .single();

        if (findError || !invite) {
          throw new Error("Invalid or expired invitation");
        }

        if (new Date(invite.expires_at) < new Date()) {
          await supabase
            .from("team_invites")
            .update({ status: "expired" })
            .eq("id", invite.id);
          throw new Error("This invitation has expired");
        }

        // Check if user email matches invite
        const { data: userProfile } = await supabase
          .from("profiles")
          .select("email")
          .eq("user_id", user.id)
          .single();

        if (userProfile?.email?.toLowerCase() !== invite.email.toLowerCase()) {
          throw new Error("This invitation was sent to a different email address");
        }

        // Add user to team
        const { error: memberError } = await supabase
          .from("team_members")
          .insert({
            team_id: invite.team_id,
            user_id: user.id,
            role: invite.role,
          });

        if (memberError) {
          if (memberError.code === '23505') {
            throw new Error("You're already a member of this team");
          }
          throw memberError;
        }

        // Update invite status
        await supabase
          .from("team_invites")
          .update({ status: "accepted" })
          .eq("id", invite.id);

        console.log(`User ${user.id} joined team ${invite.team_id}`);
        return new Response(
          JSON.stringify({ success: true, teamName: invite.teams?.name }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case 'decline': {
        const { token } = body;

        await supabase
          .from("team_invites")
          .update({ status: "declined" })
          .eq("token", token)
          .eq("status", "pending");

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case 'remove_member': {
        const { memberId, teamId } = body;

        // Verify user is team owner or admin
        const { data: userTeam } = await supabase
          .from("teams")
          .select("id")
          .eq("id", teamId)
          .eq("owner_id", user.id)
          .single();

        if (!userTeam) {
          throw new Error("Only team owners can remove members");
        }

        // Don't allow removing the owner
        const { data: member } = await supabase
          .from("team_members")
          .select("role")
          .eq("id", memberId)
          .single();

        if (member?.role === 'owner') {
          throw new Error("Cannot remove the team owner");
        }

        await supabase
          .from("team_members")
          .delete()
          .eq("id", memberId)
          .eq("team_id", teamId);

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case 'update_role': {
        const { memberId, role, teamId } = body;

        // Verify user is team owner
        const { data: userTeam } = await supabase
          .from("teams")
          .select("id")
          .eq("id", teamId)
          .eq("owner_id", user.id)
          .single();

        if (!userTeam) {
          throw new Error("Only team owners can update roles");
        }

        await supabase
          .from("team_members")
          .update({ role })
          .eq("id", memberId)
          .eq("team_id", teamId);

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case 'update_spending_limit': {
        const { memberId, teamId, spendingLimit, alertThreshold } = body;

        // Verify user is team owner
        const { data: userTeam } = await supabase
          .from("teams")
          .select("id")
          .eq("id", teamId)
          .eq("owner_id", user.id)
          .single();

        if (!userTeam) {
          throw new Error("Only team owners can update spending limits");
        }

        const updateData: Record<string, unknown> = {
          monthly_spending_limit: spendingLimit,
        };
        if (alertThreshold !== undefined) {
          updateData.spending_alert_threshold = alertThreshold;
        }

        await supabase
          .from("team_members")
          .update(updateData)
          .eq("id", memberId)
          .eq("team_id", teamId);

        console.log(`Updated spending limit for member ${memberId}: $${spendingLimit}`);

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      default:
        throw new Error("Invalid action");
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in team-invite function:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
