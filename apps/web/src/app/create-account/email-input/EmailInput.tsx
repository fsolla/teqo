"use client";

import { useCreateAccountStore } from "../useCreateAccountStore";

export const EmailInput = () => {
  const setEmail = useCreateAccountStore.use.setEmail();

  return (
    <input
      type="email"
      name="email"
      placeholder="your@email.com"
      autoFocus
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck="false"
      required
      onChange={(e) => {
        if (e.target.validity.valid) {
          setEmail(e.target.value);
        } else {
          setEmail(null);
        }
      }}
      className="outline-hidden"
    />
  );
};
