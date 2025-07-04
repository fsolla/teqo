export const getT = <Dictionary extends Record<string, string>>(
  dict: Dictionary
) => {
  return (str: keyof Dictionary) => {
    return navigator.language.startsWith("pt") ? dict[str] || str : str;
  };
};
