export const t =
  (dictionary: Record<string, string>) =>
  (key: string): string => {
    return dictionary[key] || key;
  };
