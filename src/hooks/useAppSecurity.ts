import { useState, useEffect } from 'react';
import { pinService } from '@/services/security/pinService';

export function useAppSecurity() {
  const [isPinConfigured, setIsPinConfigured] = useState<boolean>(false);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    checkPinStatus();
  }, []);

  async function checkPinStatus() {
    setIsLoading(true);
    try {
      const configured = await pinService.isPinConfigured();
      setIsPinConfigured(configured);

      if (configured) {
        // If not authenticated or no active agent, do not display lock barrier
        const activeCode =
          sessionStorage.getItem('lic_active_agency_code') ||
          localStorage.getItem('lic_active_agency_code');
        if (!activeCode) {
          setIsLocked(false);
          return;
        }
        const unlocked = pinService.isSessionUnlocked();
        setIsLocked(!unlocked);
      } else {
        setIsLocked(false);
      }
    } catch (err) {
      console.error('Error checking security status', err);
      setIsLocked(false);
    } finally {
      setIsLoading(false);
    }
  }

  function unlock() {
    setIsLocked(false);
  }

  function lock() {
    pinService.lockSession();
    setIsLocked(true);
  }

  return {
    isPinConfigured,
    isLocked,
    isLoading,
    unlock,
    lock,
    refreshSecurity: checkPinStatus,
  };
}
