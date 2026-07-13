import { useQueryClient } from "@tanstack/react-query";
import {
  useGetCurrentUser,
  useLogout,
  getGetCurrentUserQueryKey,
  type AuthUser,
} from "@workspace/api-client-react";

/**
 * Session state for the whole app. `user` is null while logged out; the
 * AuthGate in App.tsx keeps everything behind it, so pages can assume a user.
 */
export function useAuth(): {
  user: AuthUser | null;
  isLoading: boolean;
  logout: () => void;
  isLoggingOut: boolean;
} {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useGetCurrentUser({
    query: {
      queryKey: getGetCurrentUserQueryKey(),
      retry: false,
      staleTime: 5 * 60 * 1000,
    },
  });

  const logoutMutation = useLogout();

  const logout = () => {
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        // Drop every cached query — the next user must not see this user's data.
        queryClient.clear();
      },
    });
  };

  return {
    user: error ? null : (data ?? null),
    isLoading,
    logout,
    isLoggingOut: logoutMutation.isPending,
  };
}
