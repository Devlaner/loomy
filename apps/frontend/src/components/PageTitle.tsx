import { Helmet } from "react-helmet-async";

const TITLE_TEMPLATE = "%s | Loomy";
const DEFAULT_TITLE = "Loomy";

interface PageTitleProps {
  title?: string;
}

/**
 * Sets the document title. Uses template "%s | Loomy" so e.g. title="Dashboard" → "Dashboard | Loomy".
 * When no title (or an empty one) is provided, falls back to the default "Loomy" (for landing, etc.).
 */
export function PageTitle({ title }: PageTitleProps) {
  const resolvedTitle = title && title.trim().length > 0 ? title : undefined;

  return (
    <Helmet
      title={resolvedTitle}
      titleTemplate={TITLE_TEMPLATE}
      defaultTitle={DEFAULT_TITLE}
    />
  );
}
