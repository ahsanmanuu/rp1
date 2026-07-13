import { redirect } from "next/navigation";

export default function LoginAdminRedirect() {
  redirect("/admin/login");
}
