import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function Home() {
  const account = (await cookies()).get("account")?.value;

  if (account) {
    return redirect(`/${account}`);
  }

  return redirect(`/welcome/0`);
}
