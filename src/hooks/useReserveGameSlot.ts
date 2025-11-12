/**
 * useReserveGameSlot.ts
 * 
 * Custom hook for reserving a game slot using React Query mutation.
 * Prevents duplicate requests by tracking in-flight requests with a shared promise.
 */

import { useMutation } from '@tanstack/react-query';

interface ReserveGameSlotResponse {
  success: boolean;
  message?: string;
}

// Shared promise across all instances to prevent duplicate requests
let inFlightPromise: Promise<ReserveGameSlotResponse> | null = null;

async function reserveGameSlot(): Promise<ReserveGameSlotResponse> {
  // If there's already a request in flight, return the same promise
  if (inFlightPromise) {
    return inFlightPromise;
  }

  // Create new request
  const promise = (async () => {
    try {
      const response = await fetch('/api/reserve-game-slot', { method: 'POST' });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Server error');
      }

      const data = await response.json();
      return data;
    } finally {
      // Clear the in-flight promise when done
      inFlightPromise = null;
    }
  })();

  inFlightPromise = promise;
  return promise;
}

export function useReserveGameSlot() {
  return useMutation({
    mutationFn: reserveGameSlot,
    mutationKey: ['reserve-game-slot'],
  });
}

