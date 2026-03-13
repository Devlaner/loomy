import { useEffect } from "react";
import { HelmetProvider } from "react-helmet-async";
import { I18nProvider } from "@/context/I18nContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { AppRouter } from "@/routes";
import { useAuthStore } from "@/stores/authStore";

export default function App() {
  useEffect(() => {
    const token = useAuthStore.getState().token;
    if (!token) {
      const legacy = localStorage.getItem("loomy-token");
      if (legacy) {
        useAuthStore.getState().setToken(legacy);
        localStorage.removeItem("loomy-token");
      }
    }
  }, []);

  return (
    <HelmetProvider>
      <ThemeProvider>
        <I18nProvider>
          <AppRouter />
        </I18nProvider>
      </ThemeProvider>
    </HelmetProvider>
  );
}
