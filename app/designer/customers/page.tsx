import { redirect } from "next/navigation";
import { appRoutes } from "../../../lib/appRoutes";

export default function DesignerCustomersRedirect() {
  redirect(appRoutes.designer.home);
}

