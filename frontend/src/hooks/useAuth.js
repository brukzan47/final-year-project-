import { useAuth as useAuthFromContext } from "../context/AuthContext.jsx";

export function useAuth() {
  return useAuthFromContext();
}

export default useAuth;
