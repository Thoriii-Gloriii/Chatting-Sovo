/**
 * InviteButton.tsx
 * Drop this anywhere in your Settings / Profile screen.
 */
import React, { useState } from "react";
import { getOrCreateInviteCode, shareInviteLink } from "../utils/inviteLink";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Share2 } from "lucide-react";

interface Props {
  supabase: SupabaseClient<any, any, any>;
}

const InviteButton: React.FC<Props> = ({ supabase }) => {
  const [loading, setLoading] = useState(false);

  const handleShare = async () => {
    setLoading(true);
    try {
      const code = await getOrCreateInviteCode(supabase);
      await shareInviteLink(code);
    } catch (err) {
      console.error("Failed to get invite link:", err);
      alert("Could not generate invite link. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleShare}
      disabled={loading}
      className="flex items-center gap-3 w-full transition active:scale-[0.98]"
      style={{
        padding: "calc(var(--space-4) * var(--ui-scale)) var(--space-4)",
        background: "none",
        border: "none",
        color: "var(--color-text)",
        cursor: loading ? "default" : "pointer",
        fontSize: "14px",
        opacity: loading ? 0.6 : 1,
        minHeight: "var(--min-tap-target)",
      }}
    >
      <Share2
        className="w-5 h-5 flex-shrink-0"
        style={{ color: "var(--color-gold)" }}
      />
      <span>{loading ? "Generating link…" : "Invite someone to chat"}</span>
    </button>
  );
};

export default InviteButton;
