import { Page } from "../components/templates/Page";
import { getT } from "../lib/i18n";

export const NotFound = () => (
  <Page
    title={t("404 - Not Found")}
    description={t("The page you are looking for does not exist.")}
  />
);

const t = getT({
  "404 - Not Found": "404 - Página não encontrada",
  "The page you are looking for does not exist.":
    "A página que você está procurando não existe.",
});
