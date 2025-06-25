"use client";
import { useEffect, useState } from "react";

export const TextCycle = ({ content }: { content: string[] }) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prevIndex) => (prevIndex + 1) % content.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [content.length]);

  return (
    <span key={content[index]} className="animate-text-slide">
      {content[index]}
    </span>
  );
};
