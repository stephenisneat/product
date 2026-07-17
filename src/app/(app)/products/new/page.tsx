import { redirect } from "next/navigation";
import { CreateProductFlow } from "@/features/products/create-product-flow";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";

export default async function NewProductPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const active = await getActiveWorkspace();
  if (!active) {
    redirect("/");
  }

  return <CreateProductFlow />;
}
