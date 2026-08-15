'use client';

import React, { useEffect, useState } from "react";
import { GitBranch } from "lucide-react";

export default function DevEnvBanner() {
  const [mounted, setMounted] = useState(false);
  const [isDevEnv, setIsDevEnv] = useState(false);
  
  // Read the environment variable injected automatically during build
  const commitId = process.env.NEXT_PUBLIC_GIT_COMMIT_ID || "";

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      // Validate environment based on the URL (exclusively phantom-dev.gemapps.lan)
      const isTargetUrl = window.location.origin === "https://phantom-dev.gemapps.lan" || 
                          window.location.href.startsWith("https://phantom-dev.gemapps.lan/");
      setIsDevEnv(isTargetUrl);
    }
  }, []);

  if (!mounted || !isDevEnv) return null;

  return (
    <div style={{
      background: '#e11d48',
      color: 'white',
      textAlign: 'center',
      padding: '4px 8px',
      fontWeight: 'bold',
      fontSize: '12px',
      letterSpacing: '1px',
      position: 'relative',
      zIndex: 9999,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <span>DEV - Phantom</span>
      {commitId && (
        <div style={{
          position: 'absolute',
          right: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontWeight: 'normal',
          fontSize: '11px',
          textTransform: 'none'
        }}>
          <GitBranch size={14} />
          <span>{commitId}</span>
        </div>
      )}
    </div>
  );
}
