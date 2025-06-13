import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function Home() {
  const token = (await cookies()).get("token")?.value;

  if (!token) {
    return redirect("/welcome/0");
  }

  return <main className="h-full">Main</main>;
}
