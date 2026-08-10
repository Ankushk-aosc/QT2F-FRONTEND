import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function useMsalAuth() {
  const { instance } = useMsal();
  const isAuth = useIsAuthenticated();
  const router = useRouter();

  useEffect(() => {
    const acc = instance.getActiveAccount();

    if (!isAuth || !acc) {
      router.replace("/signin");
    }
  }, [isAuth, instance, router]);
}
