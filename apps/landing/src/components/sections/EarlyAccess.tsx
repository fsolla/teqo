import { EmailInput } from "../molecules/EmailInput";

export const EarlyAccess = () => (
  <section className="flex flex-col gap-4 md:gap-5 lg:gap-6 px-10">
    <h3 className="text-center">Get early access</h3>
    <EmailInput className="md:flex-row! md:min-w-160 lg:w-210 md:self-center text-black!" />
  </section>
);
