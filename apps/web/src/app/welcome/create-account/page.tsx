import { InputView } from "./InputView";

export default function Page() {
  return (
    <InputView
      title={
        <>
          Preparing your keys
          <br />
          to the digital world
        </>
      }
      description="Almost ready..."
    >
      <div className="flex-1" />
      <div className="w-full h-1 bg-teko-100 relative">
        <div className="h-full bg-tint animate-beam" />
      </div>
    </InputView>
  );
}
