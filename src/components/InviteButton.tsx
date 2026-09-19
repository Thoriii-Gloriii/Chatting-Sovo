/**
 * InviteButton.tsx
 * Drop this anywhere in your Settings / Profile screen.
 *
 * Usage:
 *   import InviteButton from "./InviteButton";
 *   // inside your Settings JSX:
 *   <InviteButton supabase={supabase} />
 */

import React, { useState } from "react";
import { getOrCreateInviteCode, shareInviteLink } from "../utils/inviteLink";
import { createClient } from "@supabase/supabase-js";

interface Props {
  supabase: ReturnType<typeof createClient>;
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
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        width: "100%",
        padding: "14px 16px",
        background: "none",
        border: "none",
        color: "inherit",
        cursor: loading ? "default" : "pointer",
        fontSize: "15px",
        opacity: loading ? 0.6 : 1,
      }}
    >
      <span style={{ fontSize: "22px" }}>🔗</span>
      <span>{loading ? "Generating link…" : "Invite someone to chat"}</span>
    </button>
  );
};

export default InviteButton;
