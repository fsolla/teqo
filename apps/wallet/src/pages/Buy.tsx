import type { ChangeEventHandler } from "preact/compat";
import { useEffect, useRef, useState } from "preact/hooks";
import { useParams } from "wouter-preact";
import { Forward } from "../components/atoms/Forward";
import { Page } from "../components/templates/Page";

export const Buy = () => {
  const { coin } = useParams<{ coin: string }>();
  const inputRef = useRef<HTMLInputElement>(null);

  const [isValid, setIsValid] = useState(false);

  const handleInput: ChangeEventHandler<HTMLInputElement> = (e) => {
    const num = Number(e.currentTarget.value.replaceAll(/[^0-9]/g, "")) * 0.01;

    setIsValid(num >= 1);

    const value =
      num === 0
        ? "$0.00"
        : num.toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
          });

    e.currentTarget.value = value;
  };

  const handleSubmit: ChangeEventHandler<HTMLButtonElement> = async () => {};

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.value = "$0.00";
    }
  }, []);

  return (
    <Page
      title="Choose amount"
      description="Insert amount of bitcoin you'd like to buy"
    >
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        name="amount"
        placeholder="$0.00"
        autoFocus
        autoCapitalize="none"
        autoCorrect="off"
        required
        title="Please enter a valid dollar amount."
        onChange={handleInput}
        maxLength={50}
      />
      <h4>0 {coin.toUpperCase()}</h4>
      <div className="flex-1" />
      <div className="flex">
        <div className="flex-1">
          <h4>Tax</h4>
          <h5>Will be discounted from inserted value</h5>
        </div>
        <Forward onClick={handleSubmit} disabled={!isValid} />
      </div>
    </Page>
  );
};
