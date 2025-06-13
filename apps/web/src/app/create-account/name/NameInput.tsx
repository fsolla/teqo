"use client";

import { useCreateAccountStore } from "../useCreateAccountStore";

export const NameInput = () => {
  const setName = useCreateAccountStore.use.setName();

  return (
    <input
      type="text"
      name="name"
      placeholder="Account name"
      autoFocus
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck="false"
      required
      onChange={(e) => setName(e.target.value)}
      className="outline-hidden"
    />
  );
};
