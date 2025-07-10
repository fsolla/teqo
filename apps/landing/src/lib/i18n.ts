import { headers } from "next/headers";

export const getT = <Dictionary extends Record<string, string>>(
  dict: Dictionary
) =>
  getPreferredLanguage().then((lang) =>
    lang === "en"
      ? (key: keyof Dictionary) => key
      : (key: keyof Dictionary) => dict[key]
  );

export const getClientT =
  <Dictionary extends Record<string, string>>(dict: Dictionary) =>
  (str: keyof Dictionary) =>
    navigator.language.startsWith("pt") ? dict[str] || str : str;

export const getPreferredLanguage = async (): Promise<"en" | "pt"> => {
  const headerList = await headers();
  const acceptLanguage = headerList.get("accept-language") || "";
  return acceptLanguage.toLowerCase().startsWith("pt") ? "pt" : "en";
};
