import { ChevronRight } from "lucide-preact";
import { Link } from "wouter-preact";
import { Page } from "../components/templates/Page";

export const SignIn = () => {
  return (
    <Page>
      <div className="flex-1" />
      <h1 className="text-center">Teqo</h1>
      <div className="flex-1" />
      <Link
        href="/input/email"
        className="bg-tint px-8.5 py-6.5 text-white flex justify-between items-center rounded-2xl"
      >
        <h4>Enter with Teqo</h4>
        <ChevronRight size={30} />
      </Link>
      <div className="flex-1" />
    </Page>
  );
};
