import { redirect } from "next/navigation";
import { appRoutes } from "../../../lib/appRoutes";

export default function DesignerAccountRedirect() {
  redirect(appRoutes.designer.home);
}

